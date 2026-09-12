import { reactive } from 'vue'
import type { MenuAction } from '@shared/ipc'
import type { DraftItem } from '@shared/ipc'
import type { UpdateCheckInfo } from '@shared/about'
import { buildAboutText } from '@shared/about'
import type { ResumeDocument, TemplateId } from '@shared/schema'
import { createDefaultDocument } from '@shared/defaults'
import { uid } from '@shared/id'
import {
  activeTab,
  activeTabId,
  activateTab,
  addDocTab,
  cancelAutosave,
  ensureHomeTab,
  findTabByPath,
  initialTemplate,
  removeTab,
  replaceTabDoc,
  reusableBlankTab,
  tabs
} from '@renderer/stores/tabs'
import type { DocTab } from '@renderer/stores/tabs'

/**
 * 文件操作流程层：确认弹窗、菜单动作、保存/打开/导出协调（渲染侧唯一入口）。
 *
 * 单窗口多标签下的两条铁律：
 * 1. **任何异步动作都必须先捕获 tab 变量**，await 之后只碰这个 tab —— 用户可能已经切走了标签
 * 2. **打开/导入一律开新标签**，因此不再需要「先问要不要保存当前简历」（只有关标签才需要）
 */

interface ModalButton {
  label: string
  value: string
  kind?: 'primary' | 'danger'
}

export const modal = reactive({
  visible: false,
  title: '',
  text: '',
  buttons: [] as ModalButton[]
})

export const toast = reactive({ visible: false, text: '' })

let modalChoose: ((v: string) => void) | null = null
let toastTimer: ReturnType<typeof setTimeout> | undefined

function ask(title: string, text: string, buttons: ModalButton[]): Promise<string> {
  return new Promise((resolve) => {
    modal.title = title
    modal.text = text
    modal.buttons = buttons
    modal.visible = true
    modalChoose = (v: string) => {
      modal.visible = false
      resolve(v)
    }
  })
}

function onChoose(v: string): void {
  modalChoose?.(v)
  modalChoose = null
}

function showToast(text: string): void {
  toast.text = text
  toast.visible = true
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toast.visible = false
  }, 3200)
}

function plainDoc(tab: DocTab): ResumeDocument {
  return JSON.parse(JSON.stringify(tab.doc)) as ResumeDocument
}

async function infoBox(title: string, text: string): Promise<void> {
  await ask(title, text, [{ label: '知道了', value: 'ok', kind: 'primary' }])
}

// ———————————————— 保存 ————————————————

/** 保存当前标签；as=true 或从未保存过则走「另存为」 */
export async function saveDoc(as = false): Promise<boolean> {
  const tab = activeTab.value
  if (tab.kind !== 'doc') return false
  const doc = plainDoc(tab)
  const useAs = as || !tab.filePath
  tab.saveStatus = 'saving'
  const r = useAs
    ? await window.myresume.file.saveAs(doc, tab.id)
    : await window.myresume.file.save(doc, tab.id)

  if (!r || r.canceled) {
    tab.saveStatus = tab.dirty ? (tab.filePath ? 'dirty' : 'draft') : 'saved'
    return false
  }
  if (r.error) {
    tab.saveStatus = 'error'
    await infoBox('保存失败', r.error)
    return false
  }
  tab.filePath = r.path!
  tab.fileName = r.name!
  tab.dirty = false
  tab.saveStatus = 'saved'
  void window.myresume.file.setDirty(false, tab.id)
  showToast(`已保存：${r.name}`)
  return true
}

/** 保存指定标签；从未保存过则弹「另存为」。返回 false = 用户取消或出错。 */
async function saveTabInteractive(tab: DocTab): Promise<boolean> {
  if (!tab.filePath) {
    const r = await window.myresume.file.saveAs(plainDoc(tab), tab.id)
    if (!r || r.canceled) return false
    if (r.error) {
      await infoBox('保存失败', r.error)
      return false
    }
    tab.filePath = r.path!
    tab.fileName = r.name!
    tab.dirty = false
    tab.saveStatus = 'saved'
    void window.myresume.file.setDirty(false, tab.id)
    return true
  }
  const r = await window.myresume.file.save(plainDoc(tab), tab.id)
  if (r?.error) {
    tab.saveStatus = 'error'
    await infoBox('保存失败', r.error)
    return false
  }
  if (r && !r.canceled) {
    tab.dirty = false
    tab.saveStatus = 'saved'
    void window.myresume.file.setDirty(false, tab.id)
  }
  return true
}

/** 保存所有未保存的标签（退出前用）；任一失败/取消即中止 */
export async function saveAllDirtyTabs(): Promise<boolean> {
  for (const tab of [...tabs]) {
    if (tab.kind !== 'doc' || !tab.dirty) continue
    cancelAutosave(tab.id)
    if (!(await saveTabInteractive(tab))) return false
  }
  return true
}

// ———————————————— 新建 / 打开 / 关闭 ————————————————

/** 新建简历：开一个新标签（当前标签完全不受影响） */
export async function newDocAction(): Promise<void> {
  const tab = addDocTab(createDefaultDocument(initialTemplate()), null, null)
  await activateTab(tab.id)
}

/** 把文档放进一个标签：优先复用当前空白标签，避免点一次打开就多一个空标签 */
async function placeDoc(
  doc: ResumeDocument,
  path: string | null,
  name: string | null,
  tabId: string
): Promise<DocTab> {
  const reusable = tabs.find((t) => t.id === tabId)
  if (reusable && reusable.kind === 'doc' && !reusable.filePath) {
    await replaceTabDoc(reusable, doc, path, name)
    return reusable
  }
  return addDocTab(doc, path, name, tabId)
}

/**
 * 打开文件/最近文件的公共流程。
 * 标签 id 必须**先**生成再交给主进程（主进程按 tabId 存会话），
 * 若复用空白标签则直接用它的 id，这样两边始终指着同一个标签。
 */
async function openFrom(
  fetch: (tabId: string) => Promise<Awaited<ReturnType<typeof window.myresume.file.open>>>
): Promise<void> {
  const reusable = reusableBlankTab()
  const tabId = reusable?.id ?? uid()
  const r = await fetch(tabId)
  if (!r || r.canceled) return
  if (r.error) {
    await infoBox('打开失败', r.error)
    return
  }
  // 同一份文件已经在别的标签里打开 → 切过去，不再开新标签
  const already = findTabByPath(r.path!)
  if (already) {
    if (tabId !== already.id) void window.myresume.file.closeTab(tabId)
    await activateTab(already.id)
    showToast(`「${already.fileName ?? r.name}」已经打开，已切换过去`)
    return
  }
  const tab = await placeDoc(r.doc!, r.path!, r.name!, tabId)
  await activateTab(tab.id)
  showToast(`已打开：${r.name}`)
}

export async function openDocAction(): Promise<void> {
  return openFrom((tabId) => window.myresume.file.open(tabId))
}

export async function openRecentAction(path: string): Promise<void> {
  return openFrom((tabId) => window.myresume.file.openRecent(tabId, path))
}

/** 关闭标签：脏文档先问；保存/丢弃后再关 */
export async function closeTabAction(id = activeTabId.value): Promise<void> {
  const tab = tabs.find((t) => t.id === id)
  if (!tab || tab.kind === 'home') return

  if (tab.dirty) {
    const name = tab.fileName ?? '未命名简历'
    const v = await ask('未保存的修改', `「${name}」有未保存的修改。`, [
      { label: '取消', value: 'cancel' },
      { label: '不保存', value: 'discard', kind: 'danger' },
      { label: '保存', value: 'save', kind: 'primary' }
    ])
    if (v === 'cancel') return
    cancelAutosave(tab.id)
    if (v === 'save') {
      if (!(await saveTabInteractive(tab))) return
    } else if (!tab.filePath) {
      // 丢弃的是还没保存过的内容 → 连同它的防丢草稿一起清掉
      await window.myresume.file.autorecoverClear(tab.doc.id)
    }
  } else {
    cancelAutosave(tab.id)
  }
  removeTab(tab.id)
}

// ———————————————— PDF 导出 ————————————————

export const exporting = reactive({ busy: false })

export async function exportPdfAction(): Promise<void> {
  if (exporting.busy) return
  const tab = activeTab.value
  if (tab.kind !== 'doc') return
  const doc = plainDoc(tab)
  exporting.busy = true
  try {
    const r = await window.myresume.pdf.export(doc)
    if (r.savedPath) {
      showToast(`已导出 PDF：${r.savedPath}`)
    } else if (r.error) {
      await infoBox('导出失败', r.error)
    }
  } finally {
    exporting.busy = false
  }
}

// ———————————————— 关于 / 草稿恢复 / 菜单 ————————————————

/** 左下角「上次有没保存的简历」提示：10 秒不理会就自动消失（草稿留在磁盘上，下次再提示） */
const DRAFT_NOTICE_MS = 10_000
let draftNoticeTimer: ReturnType<typeof setTimeout> | undefined

export const draftNotice = reactive({
  visible: false,
  count: 0,
  when: '',
  drafts: [] as DraftItem[]
})

export function dismissDraftNotice(): void {
  clearTimeout(draftNoticeTimer)
  draftNotice.visible = false
}

async function aboutAction(): Promise<void> {
  const version = await window.myresume.app.getVersion()
  let checkInfo: UpdateCheckInfo | null = null
  try {
    checkInfo = await window.myresume.update.getCheckInfo()
  } catch {
    /* 取不到就不显示那行小字，不影响「关于」本身 */
  }
  await infoBox('关于「我的简历」', buildAboutText(version, checkInfo))
}

/** 应用启动时检查未保存草稿：左下角提示 10 秒，不理会就自动消失（草稿保留，下次再提示） */
export async function initFileUI(): Promise<void> {
  try {
    const drafts = await window.myresume.file.autorecoverRead()
    if (!drafts || drafts.length === 0) return
    const newest = drafts[0]!
    draftNotice.drafts = drafts
    draftNotice.count = drafts.length
    draftNotice.when = newest.updatedAt ? new Date(newest.updatedAt).toLocaleString('zh-CN') : ''
    draftNotice.visible = true
    clearTimeout(draftNoticeTimer)
    draftNoticeTimer = setTimeout(() => {
      draftNotice.visible = false
    }, DRAFT_NOTICE_MS)
  } catch (err) {
    console.warn('草稿检查失败', err)
  }
}

/** 恢复全部草稿为标签 */
export async function restoreDraftsAction(): Promise<void> {
  const list = draftNotice.drafts
  dismissDraftNotice()
  const created: DocTab[] = []
  for (const d of list) created.push(addDocTab(d.doc, null, null))
  if (created[0]) await activateTab(created[0].id)
  showToast(`已恢复 ${created.length} 份草稿（记得及时保存为文件）`)
}

/** 丢弃全部草稿：逐份按 id 清除，绝不整目录删除 */
export async function discardDraftsAction(): Promise<void> {
  const list = draftNotice.drafts
  dismissDraftNotice()
  for (const d of list) await window.myresume.file.autorecoverClear(d.id)
  showToast('已丢弃未保存的草稿')
}

/** 原生菜单 / 工具栏统一动作入口 */
export function handleMenuAction(action: MenuAction): void {
  if (action === 'new-doc') void newDocAction()
  else if (action === 'open-doc') void openDocAction()
  else if (action === 'import-doc') void importDocAction()
  else if (action === 'save-doc') void saveDoc()
  else if (action === 'save-as-doc') void saveDoc(true)
  else if (action === 'close-tab') void closeTabAction()
  else if (action === 'save-all-and-close') {
    void (async () => {
      const ok = await saveAllDirtyTabs()
      if (ok) await window.myresume.app.closeWindow()
      else showToast('已取消关闭：还有简历没有保存')
    })()
  } else if (action === 'about') void aboutAction()
  else if (action === 'check-updates') void window.myresume.update.check()
  else if (typeof action === 'object' && action.type === 'open-recent') void openRecentAction(action.path)
}

export const modalApi = { onChoose, showToast }

// ———————————————— 导入已有简历 ————————————————

export const importUI = reactive({
  open: false,
  /** 从拖放直接带进来的文件（对话框打开后立即处理） */
  pending: null as null | { name: string; ext: string; dataBase64: string }
})

/** 打开导入流程；传入 dropped 文件则跳过选择步骤（导入一律进新标签，不会动当前简历） */
export async function importDocAction(dropped?: { name: string; ext: string; dataBase64: string }): Promise<void> {
  importUI.pending = dropped ?? null
  importUI.open = true
}

/** 导入完成：文档进新标签并切过去（提示解析统计，引导检查） */
export async function finishImport(doc: ResumeDocument): Promise<void> {
  importUI.open = false
  const reusable = reusableBlankTab()
  const tab = await placeDoc(doc, null, null, reusable?.id ?? uid())
  await activateTab(tab.id)
  const contentSections = doc.sections.filter((s) => s.type !== 'basicInfo')
  let itemCount = 0
  for (const s of contentSections) {
    const d = s.data as { items?: unknown[]; entries?: unknown[]; paragraphs?: unknown[] }
    itemCount += d.items?.length ?? d.entries?.length ?? d.paragraphs?.length ?? 0
  }
  showToast(`导入完成：${contentSections.length} 个板块 / ${itemCount} 条内容——请逐项检查修正`)
}

// ———————————————— 首页（起始页）与 AI 设置 ————————————————

export const settingsUI = reactive({ open: false })

// 开发环境自测钩子（打包版不存在）
if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>)['__mrTest'] = {
    openImport: () => {
      importUI.pending = null
      importUI.open = true
    },
    /** 自测用：直接从磁盘路径打开一份简历（跳过系统对话框，才能自动断言存盘结果） */
    openPath: (path: string) =>
      openFrom((tabId) => window.myresume.file.__testOpenPath(tabId, path)),
    /** 自测用：触发「关于」对话框（不返回 Promise——它要等用户点按钮才结束，返回会死等） */
    about: () => {
      void aboutAction()
    },
    /** 自测用：置位/复位「自动检查更新失败」标志（仅开发模式有对应通道） */
    setUpdateCheckFailed: (v: boolean) => window.myresume.update.__testSetCheckFailed(v)
  }
}

/** 切回首页标签 */
export function homeAction(): void {
  void activateTab(ensureHomeTab().id)
}

/** 从首页选模板：当前已有一份空白简历 → 直接套用；否则开新标签 */
export async function startWithTemplate(id: TemplateId): Promise<void> {
  try {
    localStorage.setItem('myresume.lastTemplate', id)
  } catch {
    /* 忽略存储失败 */
  }
  const reusable = reusableBlankTab()
  let tab: DocTab
  if (reusable) {
    reusable.doc.meta.template = id
    tab = reusable
  } else {
    tab = addDocTab(createDefaultDocument(id), null, null)
  }
  await activateTab(tab.id)
  showToast(`已用「${id === 'law-classic' ? '法学正式风' : '通用简约风'}」新建空白简历`)
}
