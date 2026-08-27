import type { BasicInfoData, EducationData, ExperienceData, ListBlockData, Section, SectionData, SectionType, TextBlockData } from './schema'
import { uid } from './id'

export interface SectionTypeDef {
  type: SectionType
  defaultTitle: string
  /** 新板块数据工厂——全部为空值，零预填内容 */
  createData(): SectionData
  /** 空板块在预览中自动隐藏 */
  isEmpty(data: SectionData): boolean
}

function contact(label: string): { id: string; label: string; value: string } {
  return { id: uid(), label, value: '' }
}

export const SECTION_TYPE_DEFS: Record<SectionType, SectionTypeDef> = {
  basicInfo: {
    type: 'basicInfo',
    defaultTitle: '基本信息',
    createData: (): BasicInfoData => ({
      name: '',
      photo: null,
      contacts: [contact('电话'), contact('邮箱'), contact('所在地')]
    }),
    isEmpty: (d) => {
      const b = d as BasicInfoData
      return !b.name.trim() && !b.photo && b.contacts.every((c) => !c.value.trim())
    }
  },
  education: {
    type: 'education',
    defaultTitle: '教育背景',
    createData: (): EducationData => ({ items: [] }),
    isEmpty: (d) => (d as EducationData).items.length === 0
  },
  experience: {
    type: 'experience',
    defaultTitle: '经历',
    createData: (): ExperienceData => ({ items: [] }),
    isEmpty: (d) => (d as ExperienceData).items.length === 0
  },
  listBlock: {
    type: 'listBlock',
    defaultTitle: '列表',
    createData: (): ListBlockData => ({ entries: [] }),
    isEmpty: (d) => (d as ListBlockData).entries.length === 0
  },
  textBlock: {
    type: 'textBlock',
    defaultTitle: '文本',
    createData: (): TextBlockData => ({ paragraphs: [''] }),
    isEmpty: (d) => (d as TextBlockData).paragraphs.every((p) => !p.trim())
  }
}

export function createSection(type: SectionType, title?: string): Section {
  const def = SECTION_TYPE_DEFS[type]
  return { id: uid(), type, title: title ?? def.defaultTitle, data: def.createData() }
}

export function isSectionEmpty(section: Section): boolean {
  return SECTION_TYPE_DEFS[section.type].isEmpty(section.data)
}
