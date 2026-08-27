import { describe, expect, it } from 'vitest'
import { createDefaultDocument } from './defaults'
import { createSection, isSectionEmpty, SECTION_TYPE_DEFS } from './sectionDefs'
import type { BasicInfoData, EducationData, ExperienceData, ListBlockData, TextBlockData } from './schema'

describe('createDefaultDocument', () => {
  it('零预填内容：所有用户可见字段为空', () => {
    const doc = createDefaultDocument()
    expect(doc.app).toBe('MyResume')
    expect(doc.schemaVersion).toBe(1)
    expect(doc.sections.map((s) => s.type)).toEqual(['basicInfo', 'education'])

    const basic = doc.sections[0]!.data as BasicInfoData
    expect(basic.name).toBe('')
    expect(basic.photo).toBeNull()
    expect(basic.contacts).toHaveLength(3)
    expect(basic.contacts.every((c) => c.value === '')).toBe(true)
    expect(basic.contacts.map((c) => c.label)).toEqual(['电话', '邮箱', '所在地'])

    const edu = doc.sections[1]!.data as EducationData
    expect(edu.items).toHaveLength(0)
  })

  it('每次生成全新文档 id', () => {
    expect(createDefaultDocument().id).not.toBe(createDefaultDocument().id)
  })
})

describe('createSection / isEmpty', () => {
  it('每种类型的新板块均为空', () => {
    for (const def of Object.values(SECTION_TYPE_DEFS)) {
      const section = createSection(def.type)
      expect(section.title).toBe(def.defaultTitle)
      expect(isSectionEmpty(section)).toBe(true)
    }
  })

  it('填入内容后不再为空', () => {
    expect(isSectionEmpty(createSection('basicInfo', '基本信息'))).toBe(true)
    const edu = createSection('education')
    ;(edu.data as EducationData).items.push({ id: 'x', school: '某大学', degree: '', date: '', extras: [] })
    expect(isSectionEmpty(edu)).toBe(false)

    const exp = createSection('experience', '实习经历')
    ;(exp.data as ExperienceData).items.push({ id: 'x', title: '某公司', date: '', role: '', details: [] })
    expect(isSectionEmpty(exp)).toBe(false)

    const list = createSection('listBlock', '技能证书')
    ;(list.data as ListBlockData).entries.push({ id: 'x', label: '', text: '法律职业资格证' })
    expect(isSectionEmpty(list)).toBe(false)

    const text = createSection('textBlock', '自我评价')
    ;(text.data as TextBlockData).paragraphs.push('认真负责')
    expect(isSectionEmpty(text)).toBe(false)
  })

  it('textBlock 全空行视为空', () => {
    const text = createSection('textBlock', '自我评价')
    ;(text.data as TextBlockData).paragraphs.push('   ', '')
    expect(isSectionEmpty(text)).toBe(true)
  })
})
