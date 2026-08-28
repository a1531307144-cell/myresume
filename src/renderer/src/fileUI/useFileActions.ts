import { reactive } from 'vue'
import type { MenuAction } from '@shared/ipc'
import type { ResumeDocument, TemplateId } from '@shared/schema'
import { createDefaultDocument } from '@shared/defaults'
import { isSectionEmpty } from '@shared/sectionDefs'
import { replaceDoc, store } from '@renderer/stores/resume'

/** 文件操作流程层：确认弹窗、菜单动作、保存/打开/导出协调（渲染侧唯一入口） */

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

function plainDoc(): ResumeDocument {
  return JSON.parse(JSON.stringify(store.doc)) as ResumeDocument
}

async function infoBox(title: string, text: string): Promise<void> {
  await ask(title, text, [{ label: '知道了', value: 'ok', kind: 'primary' }])
}

// ———————————————— 保存 ————————————————

export async function saveDoc(as = false): Promise<boolean> {
  const doc = plainDoc()
  const useAs = as || !store.filePath
  store.saveStatus = 'saving'
  const r = useAs ? await window.myresume.file.saveAs(doc) : await window.myresume.file.save(doc)

  if (!r || r.canceled) {
    store.saveStatus = store.dirty ? (store.filePath ? 'dirty' : 'draft') : 'saved'
    return false
  }
  if (r.error) {
    store.saveStatus = 'error'
    await infoBox('保存失败', r.error)
    return false
  }
  store.filePath = r.path!
  store.fileName = r.name!
  store.dirty = false
  store.saveStatus = 'saved'
  void window.myresume.file.setDirty(false)
  showToast(`已保存：${r.name}`)
  return true
}

/** 脏文档保护：取消 / 不保存 / 保存 */
async function confirmGuard(): Promise<'cancel' | 'discard' | 'save'> {
  if (!store.dirty) return 'discard'
  const v = await ask('未保存的修改', '当前简历有未保存的修改。', [
    { label: '取消', value: 'cancel' },
    { label: '不保存', value: 'discard', kind: 'danger' },
    { label: '保存', value: 'save', kind: 'primary' }
  ])
  return v as 'cancel' | 'discard' | 'save'
}

// ———————————————— 新建 / 打开 ————————————————

/** 新建简历：开一个新窗口承载，当前窗口的简历完全不受影响 */
export async function newDocAction(): Promise<void> {
  await window.myresume.file.newWindow()
}

async function openFrom(result: Awaited<ReturnType<typeof window.myresume.file.open>>): Promise<void> {
  if (!result || result.canceled) return
  if (result.error) {
    await infoBox('打开失败', result.error)
    return
  }
  await replaceDoc(result.doc!, result.path!, result.name!)
  startView.visible = false
  showToast(`已打开：${result.name}`)
}

export async function openDocAction(): Promise<void> {
  const choice = await confirmGuard()
  if (choice === 'cancel') return
  if (choice === 'save') {
    const ok = await saveDoc()
    if (!ok) return
  }
  const r = await window.myresume.file.open()
  await openFrom(r)
}

export async function openRecentAction(path: string): Promise<void> {
  const choice = await confirmGuard()
  if (choice === 'cancel') return
  if (choice === 'save') {
    const ok = await saveDoc()
    if (!ok) return
  }
  const r = await window.myresume.file.openRecent(path)
  await openFrom(r)
}

// ———————————————— PDF 导出 ————————————————

export const exporting = reactive({ busy: false })

export async function exportPdfAction(): Promise<void> {
  if (exporting.busy) return
  exporting.busy = true
  try {
    const r = await window.myresume.pdf.export(plainDoc())
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

async function aboutAction(): Promise<void> {
  const version = await window.myresume.app.getVersion()
  await infoBox(
    '关于「我的简历」',
    `我的简历 v${version}\n简单好用的桌面简历编辑器\n\nMIT 开源\nhttps://github.com/a1531307144-cell/myresume`
  )
}

/** 应用启动时检查未保存草稿（新建窗口跳过——恢复只属于应用启动流程） */
export async function initFileUI(): Promise<void> {
  if (isNewWindow) return
  try {
    const draft = await window.myresume.file.autorecoverRead()
    if (!draft?.doc) return
    const when = draft.updatedAt ? new Date(draft.updatedAt).toLocaleString('zh-CN') : '上次'
    const v = await ask('发现未保存的草稿', `检测到 ${when}编辑过但未保存的简历内容。\n恢复它继续编辑，还是丢弃？`, [
      { label: '丢弃', value: 'discard', kind: 'danger' },
      { label: '恢复', value: 'restore', kind: 'primary' }
    ])
    if (v === 'restore') {
      await replaceDoc(draft.doc, null, null)
      startView.visible = false
      showToast('已恢复草稿（记得及时保存为文件）')
    } else {
      await window.myresume.file.autorecoverClear()
    }
  } catch (err) {
    console.warn('草稿检查失败', err)
  }
}

/** 原生菜单 / 工具栏统一动作入口 */
export function handleMenuAction(action: MenuAction): void {
  if (action === 'new-doc') void newDocAction()
  else if (action === 'open-doc') void openDocAction()
  else if (action === 'import-doc') void importDocAction()
  else if (action === 'save-doc') void saveDoc()
  else if (action === 'save-as-doc') void saveDoc(true)
  else if (action === 'save-and-close') {
    void (async () => {
      const ok = await saveDoc()
      if (ok || !store.dirty) await window.myresume.app.closeWindow()
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

/** 打开导入流程（脏文档先确认）；传入 dropped 文件则跳过选择步骤 */
export async function importDocAction(dropped?: { name: string; ext: string; dataBase64: string }): Promise<void> {
  const choice = await confirmGuard()
  if (choice === 'cancel') return
  if (choice === 'save') {
    const ok = await saveDoc()
    if (!ok) return
  }
  importUI.pending = dropped ?? null
  importUI.open = true
}

/** 导入完成：换入新文档并进入编辑器（提示解析统计，引导检查） */
export async function finishImport(doc: ResumeDocument): Promise<void> {
  await replaceDoc(doc, null, null)
  importUI.open = false
  startView.visible = false
  const contentSections = doc.sections.filter((s) => s.type !== 'basicInfo')
  let itemCount = 0
  for (const s of contentSections) {
    const d = s.data as { items?: unknown[]; entries?: unknown[]; paragraphs?: unknown[] }
    itemCount += d.items?.length ?? d.entries?.length ?? d.paragraphs?.length ?? 0
  }
  showToast(`导入完成：${contentSections.length} 个板块 / ${itemCount} 条内容——请逐项检查修正`)
}

// ———————————————— 首页（起始页）与 AI 设置 ————————————————

/** 新窗口（?new=1）直接进入空白编辑器；普通启动显示首页 */
const isNewWindow = typeof location !== 'undefined' && new URLSearchParams(location.search).has('new')

export const startView = reactive({ visible: !isNewWindow })
export const settingsUI = reactive({ open: false })

// 开发环境自测钩子（打包版不存在）
if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>)['__mrTest'] = {
    openImport: () => {
      importUI.pending = null
      importUI.open = true
    }
  }
}

/** 从编辑器返回首页（当前文档保留在内存，可随时回来） */
export function homeAction(): void {
  startView.visible = true
}

/** 从首页回到正在编辑的简历 */
export function backToEditorAction(): void {
  startView.visible = false
}

/** 从首页选择模板：当前文档为空→直接套模板进入；已有内容→走「新建」保护流程 */
export async function startWithTemplate(id: TemplateId): Promise<void> {
  try {
    localStorage.setItem('myresume.lastTemplate', id)
  } catch {
    /* 忽略存储失败 */
  }
  const isEmpty = store.doc.sections.every((s) => isSectionEmpty(s))
  if (isEmpty) {
    store.doc.meta.template = id
    startView.visible = false
    return
  }
  const choice = await confirmGuard()
  if (choice === 'cancel') return
  if (choice === 'save') {
    const ok = await saveDoc()
    if (!ok) return
  }
  await window.myresume.file.newSession()
  await replaceDoc(createDefaultDocument(id), null, null)
  startView.visible = false
  showToast(`已用「${id === 'law-classic' ? '法学正式风' : '通用简约风'}」新建空白简历`)
}
