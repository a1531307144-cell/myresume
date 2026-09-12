import { computed } from 'vue'
import type { ResumeDocument, Section } from '@shared/schema'
import { createSection } from '@shared/sectionDefs'
import type { SectionPreset } from '@shared/sectionPresets'
import { isSectionEmpty } from '@shared/sectionDefs'
import { activeTab, replaceTabDoc, store } from './tabs'

/**
 * 简历 store：数据与保存状态由 stores/tabs.ts 按「当前标签」提供，
 * 本模块只保留与「单个文档内部结构」相关的操作。
 *
 * 对外形状与改造前一致（`store` / `useResumeStore` / `replaceDoc`），
 * 因此各编辑器、预览、模板组件均无需改动。
 */

export { store, activeTab } from './tabs'
export type { SaveStatus, DocTab } from './tabs'

/** 整体替换**当前标签**的文档（打开/导入/恢复草稿），不触发置脏 */
export async function replaceDoc(
  doc: ResumeDocument,
  path: string | null,
  name: string | null
): Promise<void> {
  await replaceTabDoc(activeTab.value, doc, path, name)
}

export function useResumeStore() {
  const basicInfo = computed<Section | undefined>(() =>
    store.doc.sections.find((s) => s.type === 'basicInfo')
  )
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
