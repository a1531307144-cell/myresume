import { describe, expect, it } from 'vitest'
import type { ContactField, Section } from './schema'
import { ensureJobTargetSlot, findJobTargetContact, otherContacts, readJobTarget } from './basicInfo'
import { buildDocument, parseResumeText } from './importer'
import { createDefaultDocument } from './defaults'

let n = 0
const id = (): string => `id-${++n}`

function contact(label: string, value: string): ContactField {
  return { id: id(), label, value }
}

function basicSection(contacts: ContactField[]): Section {
  return {
    id: 'basic',
    type: 'basicInfo',
    title: '基本信息',
    data: { name: '张小明', photo: null, contacts }
  }
}

describe('求职意向的读取', () => {
  it('认得出各种常见写法', () => {
    for (const label of ['求职意向', '求职方向', '意向岗位', '目标岗位', '应聘岗位', '求职目标']) {
      const sections = [basicSection([contact(label, '律所实习生')])]
      expect(readJobTarget(sections)).toBe('律所实习生')
    }
  })

  it('没有这一行、或值为空时返回空串', () => {
    expect(readJobTarget([basicSection([contact('电话', '13900001111')])])).toBe('')
    expect(readJobTarget([basicSection([contact('求职意向', '   ')])])).toBe('')
    expect(readJobTarget([])).toBe('')
    expect(readJobTarget(undefined)).toBe('')
  })

  it('findJobTargetContact 能定位到那一行', () => {
    const hit = contact('求职意向', '法务岗')
    expect(findJobTargetContact([contact('电话', 'x'), hit])?.id).toBe(hit.id)
    expect(findJobTargetContact([])).toBeUndefined()
    expect(findJobTargetContact(undefined)).toBeUndefined()
  })
})

describe('其余联系方式', () => {
  it('排除求职意向、也排除没填内容的行', () => {
    const contacts = [
      contact('求职意向', '律所实习生'),
      contact('电话', '13900001111'),
      contact('邮箱', ''),
      contact('所在地', '北京')
    ]
    expect(otherContacts(contacts).map((c) => c.label)).toEqual(['电话', '所在地'])
  })

  it('空输入返回空数组', () => {
    expect(otherContacts(undefined)).toEqual([])
  })
})

describe('保证求职意向可填', () => {
  it('没有那一行时补在最前面（醒目位置）', () => {
    const out = ensureJobTargetSlot([contact('电话', '13900001111')], id)
    expect(out.map((c) => c.label)).toEqual(['求职意向', '电话'])
    expect(out[0]!.value).toBe('')
  })

  it('已经有了就原样返回（不重复添加）', () => {
    const contacts = [contact('求职意向', '法务岗'), contact('电话', 'x')]
    expect(ensureJobTargetSlot(contacts, id)).toBe(contacts)
  })

  it('导入的简历里一定有可填的求职意向行', () => {
    const parsed = parseResumeText('张小明\n电话：13900001111\n邮箱：test@example.com\n教育背景\n', 'a.txt')
    const doc = buildDocument(parsed, 'law-classic')
    const basic = doc.sections[0]!.data as { contacts: ContactField[] }
    expect(basic.contacts.some((c) => c.label === '求职意向')).toBe(true)
  })

  it('新建空白简历也自带求职意向槽位', () => {
    const doc = createDefaultDocument()
    const basic = doc.sections[0]!.data as { contacts: ContactField[] }
    expect(basic.contacts.map((c) => c.label)).toContain('求职意向')
    expect(basic.contacts.every((c) => c.value === '')).toBe(true)
  })
})
