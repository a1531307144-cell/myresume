import { describe, expect, it } from 'vitest'
import type { ResumeDocument, Section } from './schema'
import {
  applyGenerate,
  applyRewrite,
  condenseResumeForDiagnosis,
  parseDiagnosis,
  parseGroups,
  readJobTarget,
  sectionToAiText,
  unitCount
} from './aiPrompts'

function doc(sections: Section[], contacts: { id: string; label: string; value: string }[] = []): ResumeDocument {
  return {
    app: 'MyResume',
    schemaVersion: 1,
    id: 'doc-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    meta: { template: 'law-classic' },
    sections: [
      {
        id: 'basic',
        type: 'basicInfo',
        title: '基本信息',
        data: { name: '张小明', photo: { dataUrl: 'data:image/jpeg;base64,QUJD' }, contacts }
      },
      ...sections
    ]
  }
}

const expSection: Section = {
  id: 'sec-exp',
  type: 'experience',
  title: '实习经历',
  data: {
    items: [
      { id: 'e1', title: '某某律师事务所', date: '2024.07-2024.09', role: '实习生', details: ['协助整理案卷', '旁听庭审'] },
      { id: 'e2', title: '某某法院', date: '2023.07-2023.08', role: '实习生', details: ['整理卷宗'] }
    ]
  }
}

describe('parseGroups', () => {
  it('解析 @@序号 分组，剥掉项目符号', () => {
    const raw = '@@1\n- 参与XX案件文书起草\n- 整理卷宗 30 余份\n@@2\n- 独立完成条款比对'
    expect(parseGroups(raw, 2)).toEqual([
      ['参与XX案件文书起草', '整理卷宗 30 余份'],
      ['独立完成条款比对']
    ])
  })

  it('容错各种项目符号与编号', () => {
    const raw = '@@1\n• A\n* B\n1. C\n· D'
    expect(parseGroups(raw, 1)).toEqual([['A', 'B', 'C', 'D']])
  })

  it('剥掉 ``` 代码围栏与 @@1 之前的开场白', () => {
    const raw = '```\n以下是改写结果：\n@@1\n- 内容甲\n@@2\n- 内容乙\n```'
    expect(parseGroups(raw, 2)).toEqual([['内容甲'], ['内容乙']])
  })

  it('条数与原文对不上 → 报错，绝不猜测映射', () => {
    expect(() => parseGroups('@@1\n- 只有一条', 2)).toThrow(/对不上/)
  })

  it('原文只有一条时，模型不写标记也接受', () => {
    expect(parseGroups('- 只有一行内容', 1)).toEqual([['只有一行内容']])
  })

  it('原文有多条而模型完全不分组 → 报错', () => {
    expect(() => parseGroups('- 甲\n- 乙', 3)).toThrow(/没有按格式分组/)
  })

  it('空内容 → 报错', () => {
    expect(() => parseGroups('   ', 1)).toThrow(/为空/)
  })

  it('单行过长 → 报错（不静默截断）', () => {
    expect(() => parseGroups(`@@1\n- ${'字'.repeat(600)}`, 1)).toThrow(/单行超过/)
  })

  it('跳过空分组', () => {
    expect(parseGroups('@@1\n@@2\n- 乙', 1)).toEqual([['乙']])
  })
})

describe('applyRewrite', () => {
  it('只替换描述性字段，事实字段原样保留', () => {
    const out = applyRewrite(expSection, [['新详情甲', '新详情乙'], ['新详情丙']]) as {
      items: { id: string; title: string; date: string; role: string; details: string[] }[]
    }
    expect(out.items[0]).toEqual({
      id: 'e1',
      title: '某某律师事务所',
      date: '2024.07-2024.09',
      role: '实习生',
      details: ['新详情甲', '新详情乙']
    })
    expect(out.items[1]!.details).toEqual(['新详情丙'])
  })

  it('组数少于条目时，缺的那条保持原样', () => {
    const out = applyRewrite(expSection, [['只改第一条']]) as { items: { details: string[] }[] }
    expect(out.items[0]!.details).toEqual(['只改第一条'])
    expect(out.items[1]!.details).toEqual(['整理卷宗'])
  })

  it('列表板块只改 text，label 保留', () => {
    const section: Section = {
      id: 's',
      type: 'listBlock',
      title: '技能证书',
      data: { entries: [{ id: 'x', label: '证书', text: '旧的' }] }
    }
    const out = applyRewrite(section, [['法律职业资格证', '2025 年通过']]) as {
      entries: { label: string; text: string }[]
    }
    expect(out.entries[0]).toEqual({ id: 'x', label: '证书', text: '法律职业资格证 2025 年通过' })
  })

  it('整段文字按段落替换', () => {
    const section: Section = {
      id: 's',
      type: 'textBlock',
      title: '自我评价',
      data: { paragraphs: ['旧段落一', '旧段落二'] }
    }
    const out = applyRewrite(section, [['新段落一'], ['新段落二']]) as { paragraphs: string[] }
    expect(out.paragraphs).toEqual(['新段落一', '新段落二'])
  })
})

describe('applyGenerate', () => {
  it('经历：解析「单位/时间/职务」标签行，其余进 details', () => {
    const out = applyGenerate(expSection, [
      ['单位：某某律师事务所', '时间：2025.01-2025.03', '职务：实习生', '协助整理案卷 XXX 份']
    ]) as { items: { title: string; date: string; role: string; details: string[] }[] }
    expect(out.items).toHaveLength(1)
    expect(out.items[0]!.title).toBe('某某律师事务所')
    expect(out.items[0]!.date).toBe('2025.01-2025.03')
    expect(out.items[0]!.role).toBe('实习生')
    expect(out.items[0]!.details).toEqual(['协助整理案卷 XXX 份'])
  })

  it('教育：解析「学校/时间/学位」', () => {
    const section: Section = { id: 's', type: 'education', title: '教育背景', data: { items: [] } }
    const out = applyGenerate(section, [['学校：某某大学', '时间：2021-2025', '学位：法学本科', 'GPA 3.8/4.0']]) as {
      items: { school: string; date: string; degree: string; extras: string[] }[]
    }
    expect(out.items[0]).toMatchObject({ school: '某某大学', date: '2021-2025', degree: '法学本科' })
    expect(out.items[0]!.extras).toEqual(['GPA 3.8/4.0'])
  })

  it('列表板块：一行一条，拆出 label', () => {
    const section: Section = { id: 's', type: 'listBlock', title: '技能证书', data: { entries: [] } }
    const out = applyGenerate(section, [['法律职业资格证：2025 年通过'], ['无标签的一行']]) as {
      entries: { label: string; text: string }[]
    }
    expect(out.entries).toEqual([
      { id: expect.any(String), label: '法律职业资格证', text: '2025 年通过' },
      { id: expect.any(String), label: '', text: '无标签的一行' }
    ])
  })

  it('生成的条目带全新 id（不与旧条目冲突）', () => {
    const out = applyGenerate(expSection, [['单位：甲'], ['单位：乙']]) as { items: { id: string }[] }
    const ids = out.items.map((i) => i.id)
    expect(new Set(ids).size).toBe(2)
    expect(ids).not.toContain('e1')
  })
})

describe('parseDiagnosis', () => {
  const sections: Section[] = [expSection, { id: 'sec-skill', type: 'listBlock', title: '技能证书', data: { entries: [] } }]

  it('按严重度排序并保留合法问题', () => {
    const raw = JSON.stringify({
      summary: '整体可用，但成果量化不足',
      issues: [
        { sectionId: 'sec-skill', itemIndex: 2, severity: 'low', problem: '格式不统一', suggestion: '统一为年份' },
        { sectionId: 'sec-exp', itemIndex: 1, severity: 'high', problem: '只写职责', suggestion: '补量化成果' }
      ]
    })
    const r = parseDiagnosis(raw, sections)
    expect(r.summary).toContain('量化')
    expect(r.issues.map((i) => i.severity)).toEqual(['high', 'low'])
    expect(r.issues[0]!.sectionTitle).toBe('实习经历')
  })

  it('丢弃指向不存在板块 id 的问题（幻觉 id 不能用来跳转）', () => {
    const raw = JSON.stringify({
      summary: 'x',
      issues: [
        { sectionId: '不存在的id', severity: 'high', problem: 'a', suggestion: 'b' },
        { sectionId: 'sec-exp', severity: 'high', problem: '真的', suggestion: '改' }
      ]
    })
    const r = parseDiagnosis(raw, sections)
    expect(r.issues).toHaveLength(1)
    expect(r.issues[0]!.sectionId).toBe('sec-exp')
  })

  it('最多保留 8 条', () => {
    const issues = Array.from({ length: 20 }, () => ({
      sectionId: 'sec-exp',
      severity: 'medium',
      problem: 'p',
      suggestion: 's'
    }))
    expect(parseDiagnosis(JSON.stringify({ summary: '', issues }), sections).issues).toHaveLength(8)
  })

  it('剥掉代码围栏', () => {
    const r = parseDiagnosis('```json\n{"summary":"ok","issues":[]}\n```', sections)
    expect(r.summary).toBe('ok')
  })

  it('不是 JSON → 报错', () => {
    expect(() => parseDiagnosis('我觉得还行', sections)).toThrow(/诊断结果/)
  })
})

describe('上下文读取与压缩', () => {
  it('从基本信息的联系方式里读出求职意向', () => {
    const d = doc([], [{ id: 'c1', label: '求职意向', value: '律所实习生' }])
    expect(readJobTarget(d)).toBe('律所实习生')
  })

  it('没有求职意向时返回空串', () => {
    expect(readJobTarget(doc([]))).toBe('')
  })

  it('摊平原文时带上时间/单位/职务等事实信息', () => {
    const text = sectionToAiText(expSection)
    expect(text).toContain('第 1 条：2024.07-2024.09 | 某某律师事务所 | 实习生')
    expect(text).toContain('- 协助整理案卷')
  })

  it('unitCount 按板块类型数条目', () => {
    expect(unitCount(expSection)).toBe(2)
    expect(
      unitCount({ id: 's', type: 'textBlock', title: '自我评价', data: { paragraphs: ['a', 'b', 'c'] } })
    ).toBe(3)
  })

  it('诊断摘要必须剔除照片（base64 可达数百 KB）', () => {
    const d = doc([expSection])
    const c = condenseResumeForDiagnosis(d)
    expect(c.text).not.toContain('data:image')
    expect(c.text).not.toContain('QUJD')
    expect(c.text).toContain('张小明')
  })

  it('简历过长时截断并如实标记', () => {
    const many: Section[] = Array.from({ length: 30 }, (_, i) => ({
      id: `s${i}`,
      type: 'textBlock',
      title: `板块${i}`,
      data: { paragraphs: ['字'.repeat(400)] }
    }))
    const c = condenseResumeForDiagnosis(doc(many), 3000)
    expect(c.truncated).toBe(true)
    expect(c.includedSections).toBeLessThan(c.totalSections)
  })
})
