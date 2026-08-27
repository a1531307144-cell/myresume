import type { Component } from 'vue'
import type { SectionType, TemplateId } from '@shared/schema'
import LawClassicPage from './LawClassic/LawClassicPage.vue'
import LawBasicInfo from './LawClassic/sections/LawBasicInfo.vue'
import LawEducation from './LawClassic/sections/LawEducation.vue'
import LawExperience from './LawClassic/sections/LawExperience.vue'
import LawListBlock from './LawClassic/sections/LawListBlock.vue'
import LawTextBlock from './LawClassic/sections/LawTextBlock.vue'

export interface TemplateDef {
  id: TemplateId
  name: string
  /** simple-modern 于 M4 里程碑上线 */
  available: boolean
  page: Component
  sectionRenderers: Record<SectionType, Component>
}

export const TEMPLATES: Record<TemplateId, TemplateDef> = {
  'law-classic': {
    id: 'law-classic',
    name: '法学正式风',
    available: true,
    page: LawClassicPage,
    sectionRenderers: {
      basicInfo: LawBasicInfo,
      education: LawEducation,
      experience: LawExperience,
      listBlock: LawListBlock,
      textBlock: LawTextBlock
    }
  },
  'simple-modern': {
    id: 'simple-modern',
    name: '通用简约风',
    available: false,
    page: LawClassicPage,
    sectionRenderers: {
      basicInfo: LawBasicInfo,
      education: LawEducation,
      experience: LawExperience,
      listBlock: LawListBlock,
      textBlock: LawTextBlock
    }
  }
}
