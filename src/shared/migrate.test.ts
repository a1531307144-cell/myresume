import { describe, expect, it } from 'vitest'
import { loadMigrate } from './migrate'
import { createDefaultDocument } from './defaults'

describe('loadMigrate', () => {
  it('合法文档通过并保持内容', () => {
    const doc = createDefaultDocument()
    doc.sections[0]!.title = '基本信息'
    const r = loadMigrate(JSON.parse(JSON.stringify(doc)))
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.doc.id).toBe(doc.id)
  })

  it('垃圾输入返回中文错误', () => {
    expect(loadMigrate(null).ok).toBe(false)
    expect(loadMigrate('hello').ok).toBe(false)
    expect(loadMigrate({}).ok).toBe(false)
    expect(loadMigrate({ app: 'Other' }).ok).toBe(false)
  })

  it('非 MyResume 文件被拒绝', () => {
    const r = loadMigrate({ app: 'NotMine', schemaVersion: 1 })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('我的简历')
  })

  it('未来版本被拒绝并提示升级', () => {
    const doc = createDefaultDocument()
    const future = { ...doc, schemaVersion: 99 }
    const r = loadMigrate(future)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('升级')
  })

  it('缺失 sections/meta 时修补为可用文档', () => {
    const r = loadMigrate({ app: 'MyResume', schemaVersion: 1, id: 'a' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.doc.sections).toEqual([])
      expect(r.doc.meta.template).toBe('law-classic')
    }
  })
})
