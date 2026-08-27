import type { SectionType } from './schema'

/**
 * 「添加板块」菜单的单一数据源。
 * 注意：基本信息不在此列——它永远存在于文档中且不可删除。
 */
export interface SectionPreset {
  type: SectionType
  defaultTitle: string
  /** 菜单里的一句话说明 */
  hint: string
}

export const SECTION_PRESETS: SectionPreset[] = [
  { type: 'education', defaultTitle: '教育背景', hint: '学校、学位、时间、GPA' },
  { type: 'experience', defaultTitle: '实习经历', hint: '单位、时间、职务、工作内容' },
  { type: 'experience', defaultTitle: '研究经历', hint: '课题、时间、角色、研究内容' },
  { type: 'experience', defaultTitle: '项目经历', hint: '项目、时间、角色、项目内容' },
  { type: 'experience', defaultTitle: '校园经历', hint: '组织活动、时间、职务、经历' },
  { type: 'listBlock', defaultTitle: '技能证书', hint: '「标签：内容」或纯条目' },
  { type: 'listBlock', defaultTitle: '荣誉奖项', hint: '获奖名称等条目' },
  { type: 'textBlock', defaultTitle: '自我评价', hint: '一段自由文字' },
  { type: 'textBlock', defaultTitle: '自定义文本', hint: '任意标题 + 自由文字' }
]
