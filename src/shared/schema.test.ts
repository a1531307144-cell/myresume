import { describe, expect, it } from 'vitest'
import { TEMPLATE_IDS, isTemplateId } from './schema'

describe('模板 id', () => {
  it('内含全部内置模板', () => {
    expect(TEMPLATE_IDS).toContain('law-classic')
    expect(TEMPLATE_IDS).toContain('simple-modern')
    expect(TEMPLATE_IDS).toContain('sidebar-dark')
    expect(TEMPLATE_IDS).toContain('timeline-bilingual')
    expect(TEMPLATE_IDS).toContain('grid-table')
    expect(TEMPLATE_IDS).toContain('top-band')
  })

  it('id 不重复（重复会让模板选择器出现两个同名项）', () => {
    expect(new Set(TEMPLATE_IDS).size).toBe(TEMPLATE_IDS.length)
  })

  it('isTemplateId 只认已知模板，挡住旧文档里失效的 id', () => {
    expect(isTemplateId('law-classic')).toBe(true)
    for (const id of TEMPLATE_IDS) expect(isTemplateId(id)).toBe(true)
    expect(isTemplateId('some-removed-template')).toBe(false)
    expect(isTemplateId('')).toBe(false)
    expect(isTemplateId(null)).toBe(false)
    expect(isTemplateId(undefined)).toBe(false)
    expect(isTemplateId(42)).toBe(false)
    expect(isTemplateId({ id: 'law-classic' })).toBe(false)
  })
})
