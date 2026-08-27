import { computed, watch } from 'vue'
import type { ResumeDocument, Section } from '@shared/schema'
import { createDefaultDocument } from '@shared/defaults'
import { createSection } from '@shared/sectionDefs'
import type { SectionPreset } from '@shared/sectionPresets'
import { isSectionEmpty } from '@shared/sectionDefs'

/**
 * 模块级单例 store：全应用只有一个「当前文档」状态。
 * 所有修改都是响应式数据变更，编辑器与预览自动同步——不存在手写 renderXxxList。
 */
export const store = {
  doc: createDefaultDocument('law-classic') as ResumeDocument,
  /** M2 接入文件系统后填充 */
  filePath: null as string | null,
  fileName: null as string | null,
  dirty: false,
  /** 板块选择菜单开关 */
  pickerOpen: false
}

// 深度监听：任何编辑都置脏（M2 的自动保存/关闭保护依赖此标记）
watch(
  () => store.doc,
  () => {
    store.dirty = true
    store.doc.updatedAt = new Date().toISOString()
  },
  { deep: true }
)

export function useResumeStore() {
  const basicInfo = computed<Section | undefined>(() => store.doc.sections.find((s) => s.type === 'basicInfo'))
  const visibleSections = computed<Section[]>(() => store.doc.sections.filter((s) => s.type !== 'basicInfo' && !isSectionEmpty(s)))
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

  function newDocument(): void {
    store.doc = createDefaultDocument(store.doc.meta.template)
    store.filePath = null
    store.fileName = null
    store.dirty = false
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
    renameSection,
    newDocument
  }
}
