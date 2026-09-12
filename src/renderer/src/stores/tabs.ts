import { computed, nextTick, reactive, ref, watch } from 'vue'
import type { ResumeDocument, TemplateId } from '@shared/schema'
import { isTemplateId } from '@shared/schema'
import type { SaveResult } from '@shared/ipc'
import { createDefaultDocument } from '@shared/defaults'
import { isSectionEmpty } from '@shared/sectionDefs'
import { uid } from '@shared/id'

/**
 * 标签页模型：单窗口内承载多份简历（替代原「一份简历一个窗口」）。
 *
 * 关键设计：store 的公开形状与改造前**完全一致**（doc / filePath / fileName / dirty /
 * saveStatus），只是用 getter/setter 代理到「当前标签」。因此编辑器、预览、两套模板、
 * SaveStatus 等组件一行都不用改，切标签即自动跟随。
 *
 * 三个必须守住的点：
 * 1. 切标签不得被误判为「编辑了文档」——用 suppressWatch 包住（整体替换文档时同理）
 * 2. 自动保存定时器按标签隔离——切走标签不能取消它待写盘的保存
 * 3. 首页标签常驻、不可关闭
 */

export type SaveStatus = 'saved' | 'saving' | 'dirty' | 'draft' | 'error'

export interface DocTab {
  id: string
  /** home = 起始页（常驻第一标签）；doc = 一份简历 */
  kind: 'home' | 'doc'
  doc: ResumeDocument
  /** 仅供界面显示；真实写入路径只存在主进程（最小权限路径模型） */
  filePath: string | null
  fileName: string | null
  dirty: boolean
  saveStatus: SaveStatus
}

/** 记住上次使用的模板（起始页选择时写入） */
export function initialTemplate(): TemplateId {
  try {
    const saved = localStorage.getItem('myresume.lastTemplate')
    if (isTemplateId(saved)) return saved
  } catch {
    /* 忽略读取失败 */
  }
  return 'law-classic'
}

export const tabs = reactive<DocTab[]>([])
export const activeTabId = ref('')

/** 当前标签。tabs 永不为空（ensureHomeTab 兜底），故可安全断言。 */
export const activeTab = computed<DocTab>(
  () => tabs.find((t) => t.id === activeTabId.value) ?? tabs[0]!
)

/** 当前停在首页标签（界面据此隐藏文档类按钮） */
export const isHomeTab = computed<boolean>(() => activeTab.value.kind === 'home')

function makeTab(
  kind: DocTab['kind'],
  doc: ResumeDocument,
  filePath: string | null,
  fileName: string | null,
  id?: string
): DocTab {
  return {
    id: id ?? uid(),
    kind,
    doc,
    filePath,
    fileName,
    dirty: false,
    saveStatus: filePath ? 'saved' : 'draft'
  }
}

/** 首页标签：始终存在且排第一，不可关闭 */
export function ensureHomeTab(): DocTab {
  let home = tabs.find((t) => t.kind === 'home')
  if (!home) {
    home = makeTab('home', createDefaultDocument(initialTemplate()), null, null)
    home.saveStatus = 'saved'
    tabs.unshift(home)
  }
  return home
}

ensureHomeTab()
activeTabId.value = tabs[0]!.id

// ———————————————— 对外代理：形状与改造前的 store 完全一致 ————————————————

export const store = reactive({
  get doc(): ResumeDocument {
    return activeTab.value.doc
  },
  set doc(v: ResumeDocument) {
    activeTab.value.doc = v
  },
  get filePath(): string | null {
    return activeTab.value.filePath
  },
  set filePath(v: string | null) {
    activeTab.value.filePath = v
  },
  get fileName(): string | null {
    return activeTab.value.fileName
  },
  set fileName(v: string | null) {
    activeTab.value.fileName = v
  },
  get dirty(): boolean {
    return activeTab.value.dirty
  },
  set dirty(v: boolean) {
    activeTab.value.dirty = v
  },
  get saveStatus(): SaveStatus {
    return activeTab.value.saveStatus
  },
  set saveStatus(v: SaveStatus) {
    activeTab.value.saveStatus = v
  },
  /** 纯界面状态：不随标签切换而变，故不进标签对象 */
  pickerOpen: false
})

// ———————————————— 编辑监听：置脏 + 按标签防抖自动保存 ————————————————

let suppressWatch = false
const autosaveTimers = new Map<string, ReturnType<typeof setTimeout>>()

watch(
  () => store.doc,
  () => {
    if (suppressWatch) return
    const tab = activeTab.value
    if (tab.kind !== 'doc') return // 首页标签不参与编辑与保存
    tab.dirty = true
    tab.saveStatus = tab.filePath ? 'dirty' : 'draft'
    tab.doc.updatedAt = new Date().toISOString()
    void window.myresume.file.setDirty(true, tab.id)
    scheduleAutosave(tab.id)
  },
  { deep: true }
)

function scheduleAutosave(tabId: string): void {
  clearTimeout(autosaveTimers.get(tabId))
  autosaveTimers.set(
    tabId,
    setTimeout(() => void autosaveTab(tabId), 1000)
  )
}

export function cancelAutosave(tabId: string): void {
  clearTimeout(autosaveTimers.get(tabId))
  autosaveTimers.delete(tabId)
}

/** 自动保存指定标签（注意不是「当前」标签——切走后它仍须写盘）；不产生任何界面提示 */
async function autosaveTab(tabId: string): Promise<void> {
  autosaveTimers.delete(tabId)
  const tab = tabs.find((t) => t.id === tabId)
  if (!tab || tab.kind !== 'doc' || !tab.dirty) return
  if (tab.filePath) tab.saveStatus = 'saving'
  await saveTab(tab)
}

/**
 * 保存一个标签。已有路径 → 静默写回；从未保存过 → 写应用内防丢草稿（不写用户可见位置）。
 * 本函数不弹任何对话框，供自动保存与「退出前批量保存」复用。
 */
export async function saveTab(tab: DocTab): Promise<SaveResult> {
  const plain = JSON.parse(JSON.stringify(tab.doc)) as ResumeDocument
  if (tab.filePath) {
    const r = await window.myresume.file.save(plain, tab.id)
    if (r && !r.canceled && !r.error) {
      tab.dirty = false
      tab.saveStatus = 'saved'
      void window.myresume.file.setDirty(false, tab.id)
    } else if (r?.error) {
      tab.saveStatus = 'error'
    }
    return r ?? {}
  }
  await window.myresume.file.autorecoverSave(plain)
  return {}
}

/** 整体替换某个标签的文档（打开/导入/恢复草稿），不触发置脏 */
export async function replaceTabDoc(
  tab: DocTab,
  doc: ResumeDocument,
  path: string | null,
  name: string | null
): Promise<void> {
  suppressWatch = true
  tab.doc = doc
  tab.filePath = path
  tab.fileName = name
  tab.dirty = false
  tab.saveStatus = path ? 'saved' : 'draft'
  if (path) {
    // 路径已由主进程在「打开/另存为」时写入该标签的会话
    void window.myresume.file.setDirty(false, tab.id)
  } else {
    // 明确告知主进程：这个标签从此没有关联文件，避免写入上一位用户的旧路径
    void window.myresume.file.newSession(tab.id)
  }
  await nextTick()
  suppressWatch = false
}

// ———————————————— 标签操作 ————————————————

export function addDocTab(
  doc: ResumeDocument,
  filePath: string | null,
  fileName: string | null,
  id?: string
): DocTab {
  const tab = makeTab('doc', doc, filePath, fileName, id)
  tabs.push(tab)
  return tab
}

/** 切换标签。切换本身绝不能被当成「用户编辑了文档」。 */
export async function activateTab(id: string): Promise<void> {
  if (!tabs.some((t) => t.id === id)) return
  void window.myresume.file.setActiveTab(id)
  if (activeTabId.value === id) return
  suppressWatch = true
  activeTabId.value = id
  await nextTick()
  suppressWatch = false
}

/** 关闭标签（首页标签忽略）。脏文档的确认由调用方负责。 */
export function removeTab(id: string): void {
  const i = tabs.findIndex((t) => t.id === id)
  if (i < 0) return
  const tab = tabs[i]!
  if (tab.kind === 'home') return
  cancelAutosave(id)
  tabs.splice(i, 1)
  void window.myresume.file.closeTab(id)
  if (activeTabId.value === id) {
    const next = tabs[Math.min(i, tabs.length - 1)] ?? ensureHomeTab()
    void activateTab(next.id)
  }
}

/** 标签上显示的名字：首页 / 文件名（去掉扩展名）/ 未命名简历 */
export function tabLabel(tab: DocTab): string {
  if (tab.kind === 'home') return '首页'
  return (tab.fileName ?? '未命名简历').replace(/\.(myresume|json)$/i, '')
}

/** 该文件是否已在某个标签里打开（避免同一份简历开两个标签） */
export function findTabByPath(path: string): DocTab | undefined {
  return tabs.find((t) => t.kind === 'doc' && t.filePath === path)
}

/**
 * 可复用的空白标签：内容全空、没保存过、没改过的简历标签。
 * 打开文件/导入/选模板时优先复用它，避免留下一堆空标签。优先当前标签，其次任意一个。
 */
export function reusableBlankTab(): DocTab | undefined {
  const isBlank = (t: DocTab): boolean =>
    t.kind === 'doc' && !t.filePath && !t.dirty && t.doc.sections.every((s) => isSectionEmpty(s))
  if (isBlank(activeTab.value)) return activeTab.value
  return tabs.find(isBlank)
}

// 开发环境自测钩子（打包版不存在）：供 scripts/selftest-tabs.mjs 驱动
if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>)['__mrTestTabs'] = {
    list: (): unknown[] =>
      tabs.map((t) => ({
        id: t.id,
        kind: t.kind,
        name: tabLabel(t),
        dirty: t.dirty,
        active: t.id === activeTabId.value
      })),
    activeId: (): string => activeTabId.value,
    activate: (id: string): Promise<void> => activateTab(id),
    /** 开一个空白标签并切过去，返回其 id */
    newDoc: (): string => {
      const t = addDocTab(createDefaultDocument(initialTemplate()), null, null)
      void activateTab(t.id)
      return t.id
    },
    /** 无确认弹窗地关闭标签（仅用于自测计数；界面路径走 closeTabAction） */
    close: (id: string): void => removeTab(id)
  }
}
