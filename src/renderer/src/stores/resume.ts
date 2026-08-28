import { computed, nextTick, reactive, watch } from 'vue'
import type { ResumeDocument, Section } from '@shared/schema'
import { createDefaultDocument } from '@shared/defaults'
import { createSection } from '@shared/sectionDefs'
import type { SectionPreset } from '@shared/sectionPresets'
import { isSectionEmpty } from '@shared/sectionDefs'

export type SaveStatus = 'saved' | 'saving' | 'dirty' | 'draft' | 'error'

/**
 * 模块级单例 store：全应用只有一个「当前文档」状态。
 * 所有修改都是响应式数据变更，编辑器与预览自动同步。
 */
export const store = reactive({
  doc: createDefaultDocument('law-classic') as ResumeDocument,
  filePath: null as string | null,
  fileName: null as string | null,
  dirty: false,
  saveStatus: 'draft' as SaveStatus,
  pickerOpen: false
})

// ———————————————— 编辑监听：置脏 + 防抖自动保存 ————————————————

let suppressWatch = false
let autosaveTimer: ReturnType<typeof setTimeout> | undefined

watch(
  () => store.doc,
  () => {
    if (suppressWatch) return
    store.dirty = true
    store.saveStatus = store.filePath ? 'dirty' : 'draft'
    store.doc.updatedAt = new Date().toISOString()
    void window.myresume.file.setDirty(true)
    clearTimeout(autosaveTimer)
    autosaveTimer = setTimeout(() => void autosaveNow(), 1000)
  },
  { deep: true }
)

async function autosaveNow(): Promise<void> {
  if (!store.dirty) return
  const plain = JSON.parse(JSON.stringify(store.doc)) as ResumeDocument
  if (store.filePath) {
    // 已有文件：静默写回当前文件（Word 心智）
    store.saveStatus = 'saving'
    const r = await window.myresume.file.save(plain)
    if (r && !r.canceled && !r.error) {
      store.dirty = false
      store.saveStatus = 'saved'
      void window.myresume.file.setDirty(false)
    } else if (r?.error) {
      store.saveStatus = 'error'
    }
  } else {
    // 从未保存过：写应用内防丢草稿（不写用户可见位置）
    await window.myresume.file.autorecoverSave(plain)
  }
}

/** 整体替换文档（打开/恢复草稿），不触发置脏 */
export async function replaceDoc(doc: ResumeDocument, path: string | null, name: string | null): Promise<void> {
  suppressWatch = true
  store.doc = doc
  store.filePath = path
  store.fileName = name
  store.dirty = false
  store.saveStatus = path ? 'saved' : 'draft'
  void window.myresume.file.setDirty(false)
  await nextTick()
  suppressWatch = false
}

export function useResumeStore() {
  const basicInfo = computed<Section | undefined>(() => store.doc.sections.find((s) => s.type === 'basicInfo'))
  const visibleSections = computed<Section[]>(() =>
    store.doc.sections.filter((s) => s.type !== 'basicInfo' && !isSectionEmpty(s))
  )
  const isDocumentEmpty = computed<boolean>(() => store.doc.sections.every((s) => isSectionEmpty(s)))

  function addSection(preset: SectionPreset): void {
    store.doc.sections.push(createSection(preset.type, preset.defaultTitle))
  }

  function removeSection(id: string): void {
    const i = store.doc.sections.findIndex((s) => s.id === id)
    if (i >= 0 && store.doc.sections[i]!.type !== 'basicInfo') {
      store.doc.sections.splice(i, 1)
    }
  }

  function moveSection(id: string, dir: -1 | 1): void {
    const arr = store.doc.sections
    const i = arr.findIndex((s) => s.id === id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= arr.length) return
    ;[arr[i], arr[j]] = [arr[j]!, arr[i]!]
  }

  /** 拖拽排序：把 fromId 移动到 toId 的位置上 */
  function reorderSection(fromId: string, toId: string): void {
    const arr = store.doc.sections
    const from = arr.findIndex((s) => s.id === fromId)
    const to = arr.findIndex((s) => s.id === toId)
    if (from < 0 || to < 0 || from === to) return
    const [moved] = arr.splice(from, 1)
    arr.splice(to, 0, moved!)
  }

  function renameSection(id: string, title: string): void {
    const s = store.doc.sections.find((x) => x.id === id)
    if (s) s.title = title
  }

  return {
    store,
    basicInfo,
    visibleSections,
    isDocumentEmpty,
    addSection,
    removeSection,
    moveSection,
    reorderSection,
    renameSection
  }
}
