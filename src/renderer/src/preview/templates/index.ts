import type { Component } from 'vue'
import type { SectionType, TemplateId } from '@shared/schema'
import { TEMPLATE_IDS } from '@shared/schema'
import LawClassicPage from './LawClassic/LawClassicPage.vue'
import LawBasicInfo from './LawClassic/sections/LawBasicInfo.vue'
import LawEducation from './LawClassic/sections/LawEducation.vue'
import LawExperience from './LawClassic/sections/LawExperience.vue'
import LawListBlock from './LawClassic/sections/LawListBlock.vue'
import LawTextBlock from './LawClassic/sections/LawTextBlock.vue'
import SimpleModernPage from './SimpleModern/SimpleModernPage.vue'
import SimpleBasicInfo from './SimpleModern/sections/SimpleBasicInfo.vue'
import SimpleEducation from './SimpleModern/sections/SimpleEducation.vue'
import SimpleExperience from './SimpleModern/sections/SimpleExperience.vue'
import SimpleListBlock from './SimpleModern/sections/SimpleListBlock.vue'
import SimpleTextBlock from './SimpleModern/sections/SimpleTextBlock.vue'
import SidebarDarkPage from './SidebarDark/SidebarDarkPage.vue'
import SidebarBasicInfo from './SidebarDark/sections/SidebarBasicInfo.vue'
import SidebarEducation from './SidebarDark/sections/SidebarEducation.vue'
import SidebarExperience from './SidebarDark/sections/SidebarExperience.vue'
import SidebarListBlock from './SidebarDark/sections/SidebarListBlock.vue'
import SidebarTextBlock from './SidebarDark/sections/SidebarTextBlock.vue'
import TimelineBilingualPage from './TimelineBilingual/TimelineBilingualPage.vue'
import TimelineBasicInfo from './TimelineBilingual/sections/TimelineBasicInfo.vue'
import TimelineEducation from './TimelineBilingual/sections/TimelineEducation.vue'
import TimelineExperience from './TimelineBilingual/sections/TimelineExperience.vue'
import TimelineListBlock from './TimelineBilingual/sections/TimelineListBlock.vue'
import TimelineTextBlock from './TimelineBilingual/sections/TimelineTextBlock.vue'
import GridTablePage from './GridTable/GridTablePage.vue'
import GridBasicInfo from './GridTable/sections/GridBasicInfo.vue'
import GridEducation from './GridTable/sections/GridEducation.vue'
import GridExperience from './GridTable/sections/GridExperience.vue'
import GridListBlock from './GridTable/sections/GridListBlock.vue'
import GridTextBlock from './GridTable/sections/GridTextBlock.vue'
import TopBandPage from './TopBand/TopBandPage.vue'
import TopBandBasicInfo from './TopBand/sections/TopBandBasicInfo.vue'
import TopBandEducation from './TopBand/sections/TopBandEducation.vue'
import TopBandExperience from './TopBand/sections/TopBandExperience.vue'
import TopBandListBlock from './TopBand/sections/TopBandListBlock.vue'
import TopBandTextBlock from './TopBand/sections/TopBandTextBlock.vue'

/** 起始页缩略图用的版式示意（各模板画一个抽象的小样，不依赖真实数据） */
export type TemplateMock = 'classic' | 'simple' | 'sidebar' | 'timeline' | 'grid' | 'topband'

export interface TemplateDef {
  id: TemplateId
  name: string
  available: boolean
  /** 一句话特点，显示在起始页卡片上 */
  desc: string
  mock: TemplateMock
  /** 该模板的主色（用于缩略图示意） */
  accent: string
  page: Component
  /**
   * 注意：页面组件内部已直接组合各板块渲染组件，这里仅作信息记录。
   * 保留为可选，新增模板无需再逐项填写。
   */
  sectionRenderers?: Record<SectionType, Component>
}

export const TEMPLATES: Record<TemplateId, TemplateDef> = {
  'law-classic': {
    id: 'law-classic',
    name: '法学正式风',
    available: true,
    desc: '宋体排版 · 黑白稳重 · 照片右上角',
    mock: 'classic',
    accent: '#2c2c34',
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
    available: true,
    desc: '现代无衬线 · 留白呼吸 · 靛蓝点缀',
    mock: 'simple',
    accent: '#667eea',
    page: SimpleModernPage,
    sectionRenderers: {
      basicInfo: SimpleBasicInfo,
      education: SimpleEducation,
      experience: SimpleExperience,
      listBlock: SimpleListBlock,
      textBlock: SimpleTextBlock
    }
  },
  'sidebar-dark': {
    id: 'sidebar-dark',
    name: '双栏侧边栏',
    available: true,
    desc: '深色侧栏 · 技能证书独立成栏 · 主次分明',
    mock: 'sidebar',
    accent: '#3a4560',
    page: SidebarDarkPage,
    sectionRenderers: {
      basicInfo: SidebarBasicInfo,
      education: SidebarEducation,
      experience: SidebarExperience,
      listBlock: SidebarListBlock,
      textBlock: SidebarTextBlock
    }
  },
  'timeline-bilingual': {
    id: 'timeline-bilingual',
    name: '时间轴',
    available: true,
    desc: '竖点线串联板块 · 中英双语标题 · 设计感强',
    mock: 'timeline',
    accent: '#667eea',
    page: TimelineBilingualPage,
    sectionRenderers: {
      basicInfo: TimelineBasicInfo,
      education: TimelineEducation,
      experience: TimelineExperience,
      listBlock: TimelineListBlock,
      textBlock: TimelineTextBlock
    }
  },
  'grid-table': {
    id: 'grid-table',
    name: '表格线框',
    available: true,
    desc: '细线分区 · 信息密度最高 · 一页装最多',
    mock: 'grid',
    accent: '#26262f',
    page: GridTablePage,
    sectionRenderers: {
      basicInfo: GridBasicInfo,
      education: GridEducation,
      experience: GridExperience,
      listBlock: GridListBlock,
      textBlock: GridTextBlock
    }
  },
  'top-band': {
    id: 'top-band',
    name: '顶部色带',
    available: true,
    desc: '顶部色带 · 大留白单栏 · 干净百搭',
    mock: 'topband',
    accent: '#35406b',
    page: TopBandPage,
    sectionRenderers: {
      basicInfo: TopBandBasicInfo,
      education: TopBandEducation,
      experience: TopBandExperience,
      listBlock: TopBandListBlock,
      textBlock: TopBandTextBlock
    }
  }
}

export const TEMPLATE_LIST: TemplateDef[] = TEMPLATE_IDS.map((id) => TEMPLATES[id])

/**
 * 取模板定义，**永不返回 undefined**。
 * 旧文档或损坏文件可能带着已不存在的模板 id，直接 TEMPLATES[id].page 会让渲染整页崩掉。
 */
export function getTemplate(id: unknown): TemplateDef {
  return typeof id === 'string' && id in TEMPLATES
    ? TEMPLATES[id as TemplateId]
    : TEMPLATES['law-classic']
}
