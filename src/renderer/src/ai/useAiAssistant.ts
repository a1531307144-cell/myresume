import { reactive, watch } from 'vue'
import type { AiIssue } from '@shared/aiPrompts'
import {
  applyAppend,
  applyGenerate,
  applyRewrite,
  parseDiagnosis,
  parseGroups,
  sectionToAiText,
  slimDoc,
  unitCount
} from '@shared/aiPrompts'
import type { ResumeDocument, Section } from '@shared/schema'
import type { AiRunRequest } from '@shared/ipc'
import { uid } from '@shared/id'
import { activeTab, activeTabId, tabs } from '@renderer/stores/tabs'
import { modalApi } from '@renderer/fileUI/useFileActions'
import { realRun, runAi, setAiRunnerForTest } from './aiClient'

/**
 * AI 助手状态机。
 *
 * 安全底线：**采纳之前绝不碰文档**。流式结果先校验、再预览，只有用户点「采纳替换」
 * 才把内容原地写进板块；一旦写了就自动置脏并在 1 秒后存盘。
 * 所有失败路径都保持文档一字未改。
 */

export type AiMode = 'rewrite' | 'generate' | 'append'
export type AiStatus = 'idle' | 'streaming' | 'done' | 'error'

export const aiUI = reactive({
  open: false,
  mode: 'rewrite' as AiMode,
  status: 'idle' as AiStatus,
  tabId: '',
  sectionId: '',
  sectionTitle: '',
  /** 原文（只读展示，供对照） */
  sourceText: '',
  /** 改写要求（留空 = 通顺润色） */
  instruction: '',
  /** 从零写时用户提供的信息 */
  answers: '',
  /** 累积的模型原始输出 */
  streamText: '',
  chars: 0,
  error: '',
  /** 校验通过后的分组结果 */
  groups: null as string[][] | null,
  rawText: '',
  profileName: ''
})

let currentTaskId = ''

function resetAiUI(): void {
  aiUI.status = 'idle'
  aiUI.streamText = ''
  aiUI.chars = 0
  aiUI.error = ''
  aiUI.groups = null
  aiUI.rawText = ''
  aiUI.instruction = ''
  aiUI.answers = ''
  aiUI.profileName = ''
}

/** 打开某个板块的 AI 助手；空板块自动进入「从零写」模式 */
export function openSectionAi(sectionId: string): void {
  const tab = activeTab.value
  if (tab.kind !== 'doc') return
  const section = tab.doc.sections.find((s) => s.id === sectionId)
  if (!section || section.type === 'basicInfo') return
  resetAiUI()
  currentTaskId = ''
  const count = unitCount(section)
  aiUI.open = true
  aiUI.tabId = tab.id
  aiUI.sectionId = section.id
  aiUI.sectionTitle = section.title
  aiUI.mode = count === 0 ? 'generate' : 'rewrite'
  aiUI.sourceText = sectionToAiText(section)
}

export function closeAi(): void {
  if (aiUI.status === 'streaming' && currentTaskId) {
    void window.myresume.ai.cancel(currentTaskId)
  }
  currentTaskId = ''
  aiUI.open = false
  resetAiUI()
}

export function cancelAi(): void {
  if (!currentTaskId) return
  void window.myresume.ai.cancel(currentTaskId)
  currentTaskId = ''
  aiUI.status = 'idle'
  aiUI.streamText = ''
  aiUI.chars = 0
}

/** 取当前板块（始终以「打开浮层时记下的标签」为准，不跟着当前标签漂移） */
function targetSection(): Section | undefined {
  const tab = tabs.find((t) => t.id === aiUI.tabId)
  if (!tab || tab.kind !== 'doc') return undefined
  return tab.doc.sections.find((s) => s.id === aiUI.sectionId)
}

/**
 * 跨 IPC 传对象前必须转成纯数据。
 * Vue 的响应式代理不是结构化克隆支持的类型，直接传会报
 * 「An object could not be cloned.」——这是踩过的实际 bug。
 */
function toPlain<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}

/** 组装一次 AI 请求。抽出来是为了让自测能用**完全相同的参数**走真实 IPC 验证能否跨进程传递。 */
function buildRequest(taskId: string, section: Section, doc: ResumeDocument): AiRunRequest {
  if (aiUI.mode === 'rewrite') {
    return { taskId, task: 'section-rewrite', payload: { section, instruction: aiUI.instruction, doc } }
  }
  if (aiUI.mode === 'append') {
    // 追加：把已有内容一并交给模型，并明确要求不得重复
    return { taskId, task: 'section-append', payload: { section, answers: aiUI.answers, doc } }
  }
  return { taskId, task: 'section-generate', payload: { section, answers: aiUI.answers, doc } }
}

/** 清空上一次的生成结果（切换模式时用） */
function clearResult(): void {
  aiUI.status = 'idle'
  aiUI.streamText = ''
  aiUI.chars = 0
  aiUI.error = ''
  aiUI.groups = null
  aiUI.rawText = ''
}

/** 从「改写」切到「再写一条」：板块已有内容时，追加而不是替换 */
export function startAppend(): void {
  if (aiUI.status === 'streaming') return
  aiUI.mode = 'append'
  aiUI.answers = ''
  clearResult()
}

/** 「再写一条」切回「改写」 */
export function backToRewrite(): void {
  if (aiUI.status === 'streaming') return
  aiUI.mode = 'rewrite'
  aiUI.instruction = ''
  clearResult()
}

function fail(message: string): void {
  aiUI.status = 'error'
  aiUI.error = message
}

/** 发起一次生成（改写或从零写） */
export async function runAiTask(): Promise<void> {
  if (aiUI.status === 'streaming') return
  const tab = tabs.find((t) => t.id === aiUI.tabId)
  const section = targetSection()
  if (!tab || tab.kind !== 'doc' || !section) {
    fail('板块已不存在，请重新打开')
    return
  }

  const taskId = uid()
  currentTaskId = taskId
  aiUI.status = 'streaming'
  aiUI.streamText = ''
  aiUI.chars = 0
  aiUI.error = ''
  aiUI.groups = null
  aiUI.rawText = ''
  aiUI.sourceText = sectionToAiText(section)

  const doc = toPlain(slimDoc(tab.doc))
  const payloadSection = toPlain(section)

  const req = buildRequest(taskId, payloadSection, doc)

  try {
    const r = await runAi(req, (p) => {
      if (currentTaskId !== taskId) return
      aiUI.streamText = p.text
      aiUI.chars = p.chars
    })
    if (currentTaskId !== taskId) return // 期间已被取消或换了板块

    if (!r.ok) {
      if (r.error === '__CANCELLED__') {
        aiUI.status = 'idle'
        aiUI.streamText = ''
        aiUI.chars = 0
        return
      }
      fail(r.error ?? 'AI 调用失败')
      return
    }

    aiUI.rawText = r.raw ?? ''
    aiUI.profileName = r.profileName ?? ''
    // 改写必须与原文条数完全一致；从零写与追加不锁条数
    const expected = aiUI.mode === 'rewrite' ? unitCount(section) : null
    const groups = parseGroups(aiUI.rawText, expected)
    if (aiUI.mode !== 'rewrite' && groups.length > 4) {
      throw new Error('AI 返回的条数过多，已放弃本次修改')
    }
    aiUI.groups = groups
    aiUI.status = 'done'
  } catch (err) {
    if (currentTaskId !== taskId) return
    fail(err instanceof Error ? err.message : 'AI 返回的内容无法使用')
  }
}

/** 采纳：把校验过的结果原地写进板块（会触发自动置脏与存盘） */
export function acceptAi(): void {
  if (aiUI.status !== 'done' || !aiUI.groups) return
  if (activeTabId.value !== aiUI.tabId) {
    closeAi()
    modalApi.showToast('已经切到别的简历，本次修改未应用')
    return
  }
  const section = targetSection()
  if (!section) {
    closeAi()
    modalApi.showToast('板块已被删除，本次修改未应用')
    return
  }

  // 防御纵深：写回前对最终文本再校验一遍
  let groups: string[][]
  try {
    groups = parseGroups(aiUI.rawText, aiUI.mode === 'rewrite' ? unitCount(section) : null)
  } catch (err) {
    fail(err instanceof Error ? err.message : 'AI 返回的内容无法使用')
    return
  }

  const mode = aiUI.mode
  try {
    section.data =
      mode === 'rewrite'
        ? applyRewrite(section, groups)
        : mode === 'append'
          ? applyAppend(section, groups)
          : applyGenerate(section, groups)
  } catch (err) {
    fail(err instanceof Error ? err.message : '写入失败')
    return
  }
  closeAi()
  modalApi.showToast(
    mode === 'rewrite'
      ? '已替换为 AI 改写的版本'
      : mode === 'append'
        ? `已在板块末尾追加 ${groups.length} 条`
        : '已写入 AI 生成的内容'
  )
}

// 切换标签即关闭浮层：避免把 A 简历的结果采纳到 B 简历上
watch(activeTabId, () => {
  if (aiUI.open) closeAi()
})

// ———————————————— 全文诊断 ————————————————

export const diagnoseUI = reactive({
  open: false,
  status: 'idle' as AiStatus,
  summary: '',
  issues: [] as AiIssue[],
  error: '',
  chars: 0,
  truncated: false,
  includedSections: 0,
  totalSections: 0
})

let diagnoseTaskId = ''

export function openDiagnose(): void {
  diagnoseUI.open = true
  diagnoseUI.status = 'idle'
  diagnoseUI.summary = ''
  diagnoseUI.issues = []
  diagnoseUI.error = ''
  diagnoseUI.chars = 0
  diagnoseUI.truncated = false
}

export function closeDiagnose(): void {
  if (diagnoseUI.status === 'streaming' && diagnoseTaskId) {
    void window.myresume.ai.cancel(diagnoseTaskId)
  }
  diagnoseTaskId = ''
  diagnoseUI.open = false
}

export function cancelDiagnose(): void {
  if (!diagnoseTaskId) return
  void window.myresume.ai.cancel(diagnoseTaskId)
  diagnoseTaskId = ''
  diagnoseUI.status = 'idle'
  diagnoseUI.chars = 0
}

export async function runDiagnose(): Promise<void> {
  if (diagnoseUI.status === 'streaming') return
  const tab = activeTab.value
  if (tab.kind !== 'doc') return

  const taskId = uid()
  diagnoseTaskId = taskId
  diagnoseUI.status = 'streaming'
  diagnoseUI.issues = []
  diagnoseUI.summary = ''
  diagnoseUI.error = ''
  diagnoseUI.chars = 0

  try {
    const r = await runAi(
      { taskId, task: 'diagnose', payload: { doc: toPlain(slimDoc(tab.doc)) } },
      (p) => {
        if (diagnoseTaskId !== taskId) return
        diagnoseUI.chars = p.chars
      }
    )
    if (diagnoseTaskId !== taskId) return
    if (!r.ok) {
      if (r.error === '__CANCELLED__') {
        diagnoseUI.status = 'idle'
        return
      }
      diagnoseUI.status = 'error'
      diagnoseUI.error = r.error ?? 'AI 调用失败'
      return
    }
    const parsed = parseDiagnosis(r.raw ?? '', tab.doc.sections)
    diagnoseUI.summary = parsed.summary
    diagnoseUI.issues = parsed.issues
    diagnoseUI.truncated = r.meta?.truncated ?? false
    diagnoseUI.includedSections = r.meta?.includedSections ?? 0
    diagnoseUI.totalSections = r.meta?.totalSections ?? 0
    diagnoseUI.status = 'done'
  } catch (err) {
    if (diagnoseTaskId !== taskId) return
    diagnoseUI.status = 'error'
    diagnoseUI.error = err instanceof Error ? err.message : 'AI 返回的诊断结果无法使用'
  }
}

/** 从诊断结果跳到对应板块：打开浮层并预填修改要求 */
export function applyIssue(issue: AiIssue): void {
  const tab = activeTab.value
  if (tab.kind !== 'doc' || !tab.doc.sections.some((s) => s.id === issue.sectionId)) {
    modalApi.showToast('这个板块已经不在当前简历里了')
    return
  }
  closeDiagnose()
  openSectionAi(issue.sectionId)
  aiUI.instruction = issue.suggestion || issue.problem
}

// 开发环境自测钩子（打包版不存在）：无需 API Key 即可驱动整条 AI 链路
if (import.meta.env.DEV && typeof window !== 'undefined') {
  let fakeText = ''
  let fakeError = ''

  /** 响应式代理直接序列化会给测试端返回「类数组对象」，这里统一转成纯数据 */
  const plain = <T>(v: T): T => JSON.parse(JSON.stringify(v ?? null)) as T

  const installFakeRunner = (): void => {
    setAiRunnerForTest(async (req, onProgress) => {
      // 模拟 IPC 的结构化克隆。Vue 的响应式代理无法被克隆，会抛
      // 「An object could not be cloned.」——真实调用里由 ipcRenderer.invoke 抛出，
      // 假执行器在这里主动做一遍，自动化测试才能抓住这类回归。
      structuredClone(req)

      // 分块吐出，模拟真实流式过程
      for (let i = 0; i < fakeText.length; i += 12) {
        await new Promise((r) => setTimeout(r, 20))
        onProgress({ taskId: req.taskId, chars: i + 12, text: fakeText.slice(0, i + 12) })
      }
      if (fakeError) return { ok: false, taskId: req.taskId, error: fakeError }
      return { ok: true, taskId: req.taskId, raw: fakeText, profileName: '自测模型' }
    })
  }

  ;(window as unknown as Record<string, unknown>)['__mrTestAi'] = {
    /** 让下一次 AI 调用返回这段文本（按块流式吐出），不需要真实 Key */
    setResult: (text: string, opts?: { error?: string }) => {
      fakeText = text
      fakeError = opts?.error ?? ''
      installFakeRunner()
    },
    clearResult: () => setAiRunnerForTest(null),
    open: (sectionId: string) => openSectionAi(sectionId),
    state: () => ({
      open: aiUI.open,
      mode: aiUI.mode,
      status: aiUI.status,
      sectionId: aiUI.sectionId,
      sectionTitle: aiUI.sectionTitle,
      instruction: aiUI.instruction,
      chars: aiUI.chars,
      streamText: aiUI.streamText,
      groups: plain(aiUI.groups),
      error: aiUI.error,
      canAccept: aiUI.status === 'done' && aiUI.groups !== null
    }),
    setInstruction: (s: string) => {
      aiUI.instruction = s
    },
    setAnswers: (s: string) => {
      aiUI.answers = s
    },
    /** 切到「再写一条」模式 */
    startAppend: () => startAppend(),
    run: () => runAiTask(),
    accept: () => acceptAi(),
    cancel: () => cancelAi(),
    close: () => closeAi(),
    /**
     * 用**真实 IPC 通道**发一次请求，专门验证参数能否跨进程传递。
     * 故意指向不存在的模型档案：主进程在联网之前就会返回错误，不消耗额度。
     * Vue 响应式代理忘记转纯数据时，这里会拿到「An object could not be cloned.」
     */
    probeTransport: async () => {
      const tab = tabs.find((t) => t.id === aiUI.tabId)
      const section = targetSection()
      if (!tab || tab.kind !== 'doc' || !section) return { ok: false, error: '没有可测试的板块' }
      try {
        const req = buildRequest('selftest-probe', toPlain(section), toPlain(slimDoc(tab.doc)))
        const r = await realRun({ ...req, profileId: '__no_such_profile__' }, () => {})
        return { ok: true, error: r.error ?? '' }
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) }
      }
    },
    diagnose: () => openDiagnose(),
    runDiagnose: () => runDiagnose(),
    diagnoseState: () => ({
      open: diagnoseUI.open,
      status: diagnoseUI.status,
      summary: diagnoseUI.summary,
      issues: plain(diagnoseUI.issues),
      error: diagnoseUI.error
    })
  }
}
