/** 简历文档数据契约 —— 三进程共享（无 UI / 无 Node 依赖）。文件格式即此结构的 UTF-8 JSON。 */

export const SCHEMA_VERSION = 1

export type TemplateId = 'law-classic' | 'simple-modern'

/** 5 种数据类别（SectionType）支撑 10 种板块预设。实习/研究/项目/校园共用 experience，技能/荣誉共用 listBlock。 */
export type SectionType = 'basicInfo' | 'education' | 'experience' | 'listBlock' | 'textBlock'

export interface ContactField {
  id: string
  label: string
  value: string
}

export interface BasicInfoData {
  name: string
  /** 已压缩的 JPEG dataUrl；null 表示未设置照片 */
  photo: { dataUrl: string } | null
  contacts: ContactField[]
}

export interface EducationItem {
  id: string
  school: string
  degree: string
  date: string
  /** GPA、排名等自由行，每行一条 */
  extras: string[]
}

export interface EducationData {
  items: EducationItem[]
}

export interface ExperienceItem {
  id: string
  title: string
  date: string
  role: string
  /** 详情行，每行一条 */
  details: string[]
}

export interface ExperienceData {
  items: ExperienceItem[]
}

export interface ListEntry {
  id: string
  /** 可空：有 label 渲染为「label：text」，无 label 渲染为纯文本行 */
  label: string
  text: string
}

export interface ListBlockData {
  entries: ListEntry[]
}

export interface TextBlockData {
  paragraphs: string[]
}

export type SectionData = BasicInfoData | EducationData | ExperienceData | ListBlockData | TextBlockData

export interface Section {
  id: string
  type: SectionType
  /** 用户可改的板块标题 */
  title: string
  data: SectionData
}

/** 排版个性化设置：全部可选，未设置时用模板默认值 */
export interface Typography {
  /** shared/fonts.ts 中 FONT_OPTIONS 的 id */
  fontFamily?: string
  /** 正文字号 px（12–16） */
  fontSize?: number
  /** 行距（1.4–2.0） */
  lineHeight?: number
}

export interface ResumeMeta {
  template: TemplateId
  typography?: Typography
}

export interface ResumeDocument {
  /** 文件身份标识，打开时校验 */
  app: 'MyResume'
  schemaVersion: number
  /** 文档级稳定 id —— 未来云端同步主键 */
  id: string
  createdAt: string
  updatedAt: string
  meta: ResumeMeta
  /** 有序 = 用户排序 */
  sections: Section[]
}
