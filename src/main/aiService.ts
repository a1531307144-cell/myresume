import { BrowserWindow, ipcMain } from 'electron'
import type { AiProfile, AiRunMeta, AiRunRequest, AiRunResult, AiTaskName } from '../shared/ipc'
import type { ResumeDocument, Section } from '../shared/schema'
import { normalizeAiParsed } from '../shared/importer'
import {
  buildDiagnoseSystemPrompt,
  buildDiagnoseUserPrompt,
  buildGenerateSystemPrompt,
  buildGenerateUserPrompt,
  buildRewriteSystemPrompt,
  buildRewriteUserPrompt
} from '../shared/aiPrompts'
import { getAiProfiles } from './settings'

/**
 * AI 代理（通用任务通道）：渲染进程把任务名 + 结构化入参交上来，主进程按任务表
 * 组装提示词、调用用户自配的 OpenAI 兼容接口（流式），实时回报进度，返回模型原文。
 *
 * 本层只做「传输」：提示词构造与结果校验都在 src/shared（可被 vitest 覆盖），
 * 主进程不含任何业务判断。
 *
 * 并发模型：每次请求带一个 taskId，各自持有独立的 AbortController。
 * 导入解析与板块润色可以同时进行，互不打断、进度也不会串台。
 *
 * 安全：仅允许 https:// 接口；文本长度钳制、响应体大小限制、60 秒超时、可取消；
 * Key 不写日志、不出主进程。
 */

const MAX_TEXT_CHARS = 20000
const MAX_RESPONSE_CHARS = 400_000
const TIMEOUT_MS = 60_000
const PROGRESS_EVERY_CHARS = 24
/** 并发上限：避免用户连点导致同时发起一堆积压请求 */
const MAX_CONCURRENT_TASKS = 3

const PARSE_SYSTEM_PROMPT = `你是简历解析助手。把用户提供的简历文本解析为 JSON，严格输出以下结构，不要输出任何其他内容：
{
  "name": "姓名",
  "contacts": [{"label": "电话|邮箱|微信等", "value": "..."}],
  "sections": [
    { "title": "板块标题（用原文）", "type": "education", "items": [{ "school": "", "date": "", "degree": "", "extras": ["补充行"] }] },
    { "title": "", "type": "experience", "items": [{ "title": "", "date": "", "role": "", "details": ["条目内容"] }] },
    { "title": "", "type": "listBlock", "items": [{ "label": "可为空", "text": "" }] },
    { "title": "", "type": "textBlock", "items": [{ "text": "一段文字" }] }
  ]
}
type 只能是 education / experience / listBlock / textBlock 之一。
实习、工作、项目、研究、校园经历都用 experience；证书、技能、荣誉奖项用 listBlock；自我评价用 textBlock。
缺失的字段用空字符串或空数组，不要编造简历里没有的内容。`

interface BuiltPrompt {
  system: string
  user: string
  /** 诊断任务会把「简历过长被截断」的信息回传给界面 */
  meta?: AiRunMeta
}

function clipUser(text: string): string {
  return text.length > MAX_TEXT_CHARS ? `${text.slice(0, MAX_TEXT_CHARS)}\n（后文已截断）` : text
}

function asRecord(v: unknown): Record<string, unknown> {
  return (v ?? {}) as Record<string, unknown>
}

/** 任务表：任务名 → 提示词构造。新增 AI 能力只需在这里加一项。 */
const TASK_BUILDERS: Record<AiTaskName, (payload: unknown) => BuiltPrompt> = {
  'parse-resume': (payload) => {
    const text = typeof asRecord(payload)['text'] === 'string' ? (asRecord(payload)['text'] as string) : ''
    if (!text.trim()) throw new Error('没有可解析的文本内容')
    return { system: PARSE_SYSTEM_PROMPT, user: `请解析以下简历文本：\n\n${clipUser(text)}` }
  },

  'section-rewrite': (payload) => {
    const p = asRecord(payload)
    const section = p['section'] as Section | undefined
    const doc = p['doc'] as ResumeDocument | undefined
    if (!section || !doc) throw new Error('缺少板块内容')
    return {
      system: buildRewriteSystemPrompt(),
      user: clipUser(
        buildRewriteUserPrompt({
          section,
          instruction: typeof p['instruction'] === 'string' ? (p['instruction'] as string) : '',
          doc
        })
      )
    }
  },

  'section-generate': (payload) => {
    const p = asRecord(payload)
    const section = p['section'] as Section | undefined
    const doc = p['doc'] as ResumeDocument | undefined
    if (!section || !doc) throw new Error('缺少板块内容')
    return {
      system: buildGenerateSystemPrompt(),
      user: clipUser(
        buildGenerateUserPrompt({
          section,
          answers: typeof p['answers'] === 'string' ? (p['answers'] as string) : '',
          doc
        })
      )
    }
  },

  diagnose: (payload) => {
    const doc = asRecord(payload)['doc'] as ResumeDocument | undefined
    if (!doc) throw new Error('缺少简历内容')
    const built = buildDiagnoseUserPrompt(doc)
    return {
      system: buildDiagnoseSystemPrompt(),
      user: clipUser(built.text),
      meta: {
        truncated: built.truncated,
        totalSections: built.totalSections,
        includedSections: built.includedSections
      }
    }
  }
}

/** 进行中的任务：taskId → 该任务自己的中断控制器 */
interface Inflight {
  controller: AbortController
  senderId: number
  timedOut: boolean
}
const inflight = new Map<string, Inflight>()

function broadcastProgress(taskId: string, chars: number, text: string): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('ai:progress', { taskId, chars, text })
  }
}

/** 窗口关闭时清掉它发起的任务，避免流一直挂着 */
export function destroyAiForSender(webContentsId: number): void {
  for (const [taskId, entry] of [...inflight]) {
    if (entry.senderId === webContentsId) {
      entry.controller.abort()
      inflight.delete(taskId)
    }
  }
}

/** 剥掉模型可能加的 ``` 围栏 */
function stripFence(content: string): string {
  return content.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
}

export function registerAiIpc(): void {
  ipcMain.handle('ai:run', async (e, req: unknown): Promise<AiRunResult> => {
    const r = asRecord(req)
    const taskId = typeof r['taskId'] === 'string' ? (r['taskId'] as string) : ''
    if (!taskId) return { ok: false, taskId: '', error: '内部错误：缺少任务标识' }
    if (inflight.has(taskId)) return { ok: false, taskId, error: '该任务正在进行中' }
    if (inflight.size >= MAX_CONCURRENT_TASKS) {
      return { ok: false, taskId, error: '同时进行的 AI 任务过多，请稍后再试' }
    }

    const task = r['task'] as AiTaskName
    const builder = TASK_BUILDERS[task]
    if (!builder) return { ok: false, taskId, error: '内部错误：未知的 AI 任务' }

    let built: BuiltPrompt
    try {
      built = builder(r['payload'])
    } catch (err) {
      return { ok: false, taskId, error: err instanceof Error ? err.message : '任务内容构造失败' }
    }

    const profileId = typeof r['profileId'] === 'string' ? (r['profileId'] as string) : ''
    const { profiles, activeId } = await getAiProfiles()
    const profile: AiProfile | undefined = profileId
      ? profiles.find((p) => p.id === profileId)
      : (profiles.find((p) => p.id === activeId) ?? profiles[0])
    if (!profile) return { ok: false, taskId, error: '尚未配置 AI 模型，请先在「AI 模型管理」中添加' }
    if (!profile.apiKey) return { ok: false, taskId, error: `「${profile.name}」还没有填写 API Key` }

    let url: URL
    try {
      url = new URL(profile.baseUrl)
      if (url.protocol !== 'https:') throw new Error('非 HTTPS')
    } catch {
      return { ok: false, taskId, error: `「${profile.name}」的接口地址无效（必须是以 https:// 开头的完整地址）` }
    }

    const controller = new AbortController()
    const entry: Inflight = { controller, senderId: e.sender.id, timedOut: false }
    inflight.set(taskId, entry)
    const timer = setTimeout(() => {
      entry.timedOut = true
      controller.abort()
    }, TIMEOUT_MS)
    broadcastProgress(taskId, 0, '')

    try {
      const res = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${profile.apiKey}`
        },
        body: JSON.stringify({
          model: profile.model,
          temperature: 0.2,
          stream: true,
          messages: [
            { role: 'system', content: built.system },
            { role: 'user', content: built.user }
          ]
        })
      })

      if (!res.ok) {
        const raw = await res.text()
        if (raw.length > MAX_RESPONSE_CHARS) return { ok: false, taskId, error: 'AI 服务返回内容过大' }
        const hint =
          res.status === 401 ? '（API Key 可能不正确）' : res.status === 429 ? '（请求过于频繁或额度不足）' : ''
        return { ok: false, taskId, error: `AI 服务返回错误 ${res.status}${hint}`, profileName: profile.name }
      }

      // 流式（SSE）优先；服务不支持流式时回退整体 JSON
      const contentType = res.headers.get('content-type') ?? ''
      let content: string
      if (contentType.includes('text/event-stream') && res.body) {
        content = await consumeStream(taskId, res.body, controller)
        broadcastProgress(taskId, content.length, content)
      } else {
        const raw = await res.text()
        if (raw.length > MAX_RESPONSE_CHARS) return { ok: false, taskId, error: 'AI 服务返回内容过大' }
        try {
          const json = JSON.parse(raw) as { choices?: { message?: { content?: unknown } }[] }
          content = typeof json.choices?.[0]?.message?.content === 'string' ? json.choices[0]!.message!.content! : ''
        } catch {
          return { ok: false, taskId, error: 'AI 服务返回了无法理解的内容' }
        }
      }

      if (!content.trim()) return { ok: false, taskId, error: 'AI 返回内容为空' }
      const cleaned = stripFence(content)

      // 导入解析：主进程直接归一化成结构化结果（沿用既有实现，不动）
      if (task === 'parse-resume') {
        let parsedJson: unknown
        try {
          parsedJson = JSON.parse(cleaned)
        } catch {
          return { ok: false, taskId, error: 'AI 返回的不是有效 JSON，请重试一次' }
        }
        const parsed = normalizeAiParsed(parsedJson)
        if (parsed.sections.length === 0 && !parsed.name) {
          return { ok: false, taskId, error: 'AI 未能从文本中识别出简历内容' }
        }
        return { ok: true, taskId, parsed, profileName: profile.name }
      }

      // 其余任务把模型原文交回渲染层，由 shared 的纯函数做校验与写回
      return { ok: true, taskId, raw: cleaned, meta: built.meta, profileName: profile.name }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // 超时与「用户主动取消」必须区分开：超时是失败，取消是静默的
        return {
          ok: false,
          taskId,
          error: entry.timedOut ? 'AI 响应超时（60 秒），请重试' : '__CANCELLED__'
        }
      }
      return { ok: false, taskId, error: '无法连接 AI 服务，请检查网络与接口地址', profileName: profile.name }
    } finally {
      clearTimeout(timer)
      if (inflight.get(taskId) === entry) inflight.delete(taskId)
    }
  })

  ipcMain.handle('ai:cancel', (_e, taskId: unknown) => {
    if (typeof taskId !== 'string') return
    inflight.get(taskId)?.controller.abort()
  })

  // 「测试连接」：可直接测试未保存的表单内容；apiKey 留空时用已存档案的 Key
  ipcMain.handle(
    'ai:test',
    async (_e, probe: unknown): Promise<{ ok: boolean; error?: string }> => {
      const p = asRecord(probe)
      const id = typeof p['id'] === 'string' ? p['id'] : ''
      const { profiles } = await getAiProfiles()
      const stored = id ? profiles.find((x) => x.id === id) : undefined

      const baseUrl = typeof p['baseUrl'] === 'string' ? p['baseUrl'].trim() : (stored?.baseUrl ?? '')
      const model = typeof p['model'] === 'string' ? p['model'].trim() : (stored?.model ?? '')
      const keyInput = typeof p['apiKey'] === 'string' ? p['apiKey'].trim() : ''
      const apiKey = keyInput || (stored?.apiKey ?? '')

      if (!baseUrl || !model || !apiKey) return { ok: false, error: '请先填写完整配置（含 API Key）' }
      try {
        const url = new URL(baseUrl)
        if (url.protocol !== 'https:') return { ok: false, error: '接口地址必须是 https:// 开头' }
        const res = await fetch(url, {
          method: 'POST',
          signal: AbortSignal.timeout(15_000),
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model,
            max_tokens: 8,
            messages: [{ role: 'user', content: '回复"OK"两个字母即可' }]
          })
        })
        if (res.ok) return { ok: true }
        if (res.status === 401) return { ok: false, error: '认证失败：请检查 API Key' }
        if (res.status === 404) return { ok: false, error: '接口地址不存在：请检查地址是否为完整的 …/chat/completions' }
        return { ok: false, error: `服务返回 ${res.status}` }
      } catch {
        return { ok: false, error: '连接失败：请检查网络与接口地址' }
      }
    }
  )
}

/** 读取 SSE 流：累积 delta.content，节流回报进度（含累积文本，供界面实时展示） */
async function consumeStream(
  taskId: string,
  body: ReadableStream<Uint8Array>,
  controller: AbortController
): Promise<string> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let content = ''
  let received = 0
  let lastReported = 0

  for (;;) {
    if (controller.signal.aborted) {
      await reader.cancel().catch(() => {})
      throw new DOMException('Aborted', 'AbortError')
    }
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const data = trimmed.slice(5).trim()
      if (!data || data === '[DONE]') continue
      try {
        const json = JSON.parse(data) as { choices?: { delta?: { content?: unknown } }[] }
        const delta = json.choices?.[0]?.delta?.content
        if (typeof delta === 'string' && delta) {
          content += delta
          received += delta.length
          if (received > MAX_RESPONSE_CHARS) {
            await reader.cancel().catch(() => {})
            throw new Error('AI 返回内容过大')
          }
        }
      } catch {
        /* 忽略心跳/无法解析的行 */
      }
    }
    if (received - lastReported >= PROGRESS_EVERY_CHARS) {
      lastReported = received
      broadcastProgress(taskId, received, content)
    }
  }
  return content
}
