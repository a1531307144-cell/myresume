import type { ResumeDocument, SectionType, TemplateId } from './schema'
import { createSection } from './sectionDefs'
import { uid } from './id'

/**
 * 简历文本 → 结构化数据的启发式解析（离线、无 AI 时的基础路径）。
 * 纯函数；AI 解析结果也复用 ParsedResume 中间结构与 buildDocument。
 * 注意：输入是不可信文本——解析全程只做字符串操作，无任何求值/网络。
 */

export interface ParsedContacts {
  label: string
  value: string
}

export interface ParsedSection {
  type: SectionType
  title: string
  /** experience 类: {title,date,role,details}; education: {school,date,degree,extras}; listBlock: {label,text}; textBlock: {text} */
  items: Record<string, string | string[]>[]
}

export interface ParsedResume {
  name: string
  contacts: ParsedContacts[]
  sections: ParsedSection[]
}

const PHONE_RE = /1[3-9]\d{9}/
const EMAIL_RE = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/

/** 年份/日期段（如 2023.09、2021年9月、2020.06 – 2024.06、2023.09-至今） */
const DATE_RE = /(?:19|20)\d{2}\s*[.．年/\-]\s*(?:\d{1,2}\s*月?)?|(?:19|20)\d{2}(?!\d)/g
const HAS_DATE_RE = /(?:19|20)\d{2}/

/** 板块标题词典：关键词 → 数据类型。匹配时保留原文作标题。 */
const TITLE_MAP: { kw: string[]; type: SectionType }[] = [
  { kw: ['教育背景', '教育经历', '教育情况'], type: 'education' },
  { kw: ['实习经历', '实习经验', '实践经历', '工作经历', '工作经验', '职业经历', '实习与实践'], type: 'experience' },
  { kw: ['项目经历', '项目经验', '项目实践'], type: 'experience' },
  { kw: ['研究经历', '科研经历', '科研情况', '学术经历'], type: 'experience' },
  { kw: ['校园经历', '校园实践', '学生工作', '学生活动', '社团经历', '社团活动', '校内经历', '社会实践', '组织经历'], type: 'experience' },
  { kw: ['荣誉奖项', '获奖情况', '荣誉称号', '荣誉', '获奖', '奖励', '奖学金'], type: 'listBlock' },
  { kw: ['技能证书', '专业技能', '计算机技能', '语言能力', '语言技能', '技能特长', '技能', '证书'], type: 'listBlock' },
  { kw: ['自我评价', '个人评价', '自我描述', '自我介绍', '个人简介', '关于我'], type: 'textBlock' },
  { kw: ['兴趣爱好', '兴趣特长'], type: 'textBlock' }
]

function stripDecorations(line: string): string {
  return line
    .replace(/^[\s【\[（(·•●▪◦\-\–—*|】\]）)】]+/, '')
    .replace(/[\s】\]）)：:．.]+$/, '')
    .trim()
}

/** 判断一行是否是板块标题；返回其数据类型 */
function matchTitle(rawLine: string): SectionType | null {
  const line = stripDecorations(rawLine)
  if (!line || line.length > 12) return null
  for (const { kw, type } of TITLE_MAP) {
    for (const k of kw) {
      if (line === k || line.startsWith(k)) {
        // 剩余部分只允许少量装饰字符（如「教育背景 EXPERIENCE」「实习经历一」过长则不算）
        const rest = line.slice(k.length).replace(/[\sA-Za-z/|一-九0-9]/g, '')
        if (rest.length === 0) return type
      }
    }
  }
  return null
}

function extractDates(line: string): string[] {
  return line.match(DATE_RE) ?? []
}

function cleanDate(d: string): string {
  return d.replace(/\s+/g, '').replace(/[．]/g, '.').replace(/[年月]/g, (m) => (m === '年' ? '.' : ''))
}

/** 把「XX公司 | 产品实习生」拆成 title 与 role */
function splitTitleRole(text: string): { title: string; role: string } {
  const parts = text.split(/\s*[|｜/]\s*/).filter(Boolean)
  if (parts.length >= 2) {
    const last = parts[parts.length - 1]!
    if (last.length <= 12) {
      return { title: parts.slice(0, -1).join(' / '), role: last }
    }
  }
  return { title: text, role: '' }
}

function stripBullets(line: string): string {
  return line.replace(/^[\s·•●▪◦\-–—*＞>]+/, '').trim()
}

function isBulletLine(line: string): boolean {
  return /^[\s·•●▪◦\-–—*＞>]/.test(line)
}

/** 提取纯文本简历的结构（启发式） */
export function parseResumeText(text: string, fileName = ''): ParsedResume {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\t/g, ' ').trimEnd())
    .filter((l) => l.trim().length > 0)

  const result: ParsedResume = { name: '', contacts: [], sections: [] }

  // —— 第一步：找板块标题，划分区域 ——
  const blocks: { type: SectionType | null; title: string; lines: string[] }[] = []
  let current: { type: SectionType | null; title: string; lines: string[] } = { type: null, title: '', lines: [] }
  for (const line of lines) {
    const t = matchTitle(line)
    if (t) {
      if (current.lines.length > 0 || current.type) blocks.push(current)
      current = { type: t, title: stripDecorations(line), lines: [] }
    } else {
      current.lines.push(line.trim())
    }
  }
  if (current.lines.length > 0 || current.type) blocks.push(current)

  // —— 第二步：姓名（文件名优先）与联系方式 ——
  // 文件名通常最可靠（如「李四的简历.docx」）；识别不出再退回首行短文本
  if (fileName) {
    const guess = stripDecorations(
      fileName
        .replace(/\.(docx?|pdf|txt)$/i, '')
        .replace(/简历|resume|_|-/gi, '')
        .replace(/[的之]+$/, '')
    )
    if (guess.length >= 2 && guess.length <= 6) result.name = guess
  }

  const head = blocks.find((b) => b.type === null)
  const headLines = head?.lines ?? []
  const usedHead = new Set<number>()

  for (let i = 0; i < headLines.length; i++) {
    const line = headLines[i]!
    if (!result.name && line.length >= 2 && line.length <= 4 && !/[\d\w@.·]/.test(line)) {
      result.name = line
      usedHead.add(i)
      continue
    }
    const phone = line.match(PHONE_RE)?.[0]
    if (phone) {
      const label = /微信|weChat/i.test(line) ? '微信' : '电话'
      if (!result.contacts.some((c) => c.value === phone)) result.contacts.push({ label, value: phone })
      usedHead.add(i)
      continue
    }
    const email = line.match(EMAIL_RE)?.[0]
    if (email) {
      if (!result.contacts.some((c) => c.value === email)) result.contacts.push({ label: '邮箱', value: email })
      usedHead.add(i)
      continue
    }
  }

  // 文件名兜底逻辑已前移（优先于首行短文本）

  // —— 第三步：各板块内容解析 ——
  const leftovers: string[] = []

  for (const block of blocks) {
    if (block.type === null) {
      for (let i = 0; i < block.lines.length; i++) {
        if (!usedHead.has(i)) leftovers.push(block.lines[i]!)
      }
      continue
    }

    const section: ParsedSection = { type: block.type, title: block.title, items: [] }

    if (block.type === 'education') {
      for (const line of block.lines) {
        if (HAS_DATE_RE.test(line)) {
          const dates = extractDates(line)
          const date = dates.map(cleanDate).join('–')
          let rest = line
          for (const d of dates) rest = rest.replace(d, '')
          rest = stripDecorations(rest.replace(/[|｜]/g, ' ')).replace(/^[-–—\s]+/, '')
          section.items.push({ school: rest, date, degree: '', extras: [] })
        } else {
          const last = section.items[section.items.length - 1] as { extras: string[] } | undefined
          if (last) (last as { extras: string[] }).extras.push(stripBullets(line))
          else section.items.push({ school: stripBullets(line), date: '', degree: '', extras: [] })
        }
      }
    } else if (block.type === 'experience') {
      for (const line of block.lines) {
        if (HAS_DATE_RE.test(line) && !isBulletLine(line)) {
          const dates = extractDates(line)
          const date = dates.map(cleanDate).join('–')
          let rest = line
          for (const d of dates) rest = rest.replace(d, '')
          const { title, role } = splitTitleRole(stripDecorations(rest))
          section.items.push({ title, date, role, details: [] })
        } else {
          const content = stripBullets(line)
          const last = section.items[section.items.length - 1] as { details: string[] } | undefined
          if (last) (last as { details: string[] }).details.push(content)
          else section.items.push({ title: content, date: '', role: '', details: [] })
        }
      }
    } else if (block.type === 'listBlock') {
      for (const line of block.lines) {
        const content = stripBullets(line)
        const m = content.match(/^([^：:]{1,8})[：:]\s*(.+)$/)
        if (m) section.items.push({ label: m[1]!, text: m[2]! })
        else section.items.push({ label: '', text: content })
      }
    } else {
      // textBlock：每行一段
      for (const line of block.lines) {
        section.items.push({ text: stripBullets(line) })
      }
    }

    result.sections.push(section)
  }

  // 没归类的散行不静默丢弃
  if (leftovers.length > 0) {
    result.sections.push({ type: 'textBlock', title: '其他', items: leftovers.map((l) => ({ text: stripBullets(l) })) })
  }

  return result
}

/** 解析结果 → 应用文档（全部走正规板块工厂，保证数据契约一致） */
export function buildDocument(parsed: ParsedResume, template: TemplateId): ResumeDocument {
  const doc: ResumeDocument = {
    app: 'MyResume',
    schemaVersion: 1,
    id: uid(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    meta: { template },
    sections: []
  }

  const basic = createSection('basicInfo', '基本信息')
  const basicData = basic.data as {
    name: string
    photo: null
    contacts: { id: string; label: string; value: string }[]
  }
  basicData.name = parsed.name
  basicData.contacts = parsed.contacts.length
    ? parsed.contacts.map((c) => ({ id: uid(), label: c.label, value: c.value }))
    : basicData.contacts // 无联系方式时保留三个空槽位
  doc.sections.push(basic)

  for (const ps of parsed.sections) {
    const section = createSection(ps.type, ps.title)
    if (ps.type === 'education') {
      const data = section.data as { items: { id: string; school: string; degree: string; date: string; extras: string[] }[] }
      data.items = ps.items
        .map((it) => ({
          id: uid(),
          school: String(it['school'] ?? ''),
          degree: String(it['degree'] ?? ''),
          date: String(it['date'] ?? ''),
          extras: (it['extras'] as string[]) ?? []
        }))
        .filter((it) => it.school || it.degree || it.date || it.extras.length)
    } else if (ps.type === 'experience') {
      const data = section.data as { items: { id: string; title: string; date: string; role: string; details: string[] }[] }
      data.items = ps.items
        .map((it) => ({
          id: uid(),
          title: String(it['title'] ?? ''),
          date: String(it['date'] ?? ''),
          role: String(it['role'] ?? ''),
          details: (it['details'] as string[]) ?? []
        }))
        .filter((it) => it.title || it.date || it.role || it.details.length)
    } else if (ps.type === 'listBlock') {
      const data = section.data as { entries: { id: string; label: string; text: string }[] }
      data.entries = ps.items
        .map((it) => ({ id: uid(), label: String(it['label'] ?? ''), text: String(it['text'] ?? '') }))
        .filter((it) => it.label || it.text)
    } else {
      const data = section.data as { paragraphs: string[] }
      data.paragraphs = ps.items.map((it) => String(it['text'] ?? '')).filter((t) => t.trim())
    }
    doc.sections.push(section)
  }

  return doc
}

// ———————————————— AI 解析结果的校验与归一化 ————————————————

const MAX_ITEMS_PER_SECTION = 100
const MAX_STR = 2000

function safeStr(v: unknown): string {
  if (typeof v !== 'string') return ''
  return v.length > MAX_STR ? v.slice(0, MAX_STR) : v
}

function safeArr(v: unknown): unknown[] {
  if (!Array.isArray(v)) return []
  return v.slice(0, MAX_ITEMS_PER_SECTION)
}

/**
 * AI 返回的 JSON 不可信：逐字段校验钳制，任何畸形输入都归一为安全结构或抛出中文错误。
 * 期望形状：{ name?, contacts?[{label,value}], sections?[{title?, type?, items?...}] }
 */
export function normalizeAiParsed(raw: unknown): ParsedResume {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('AI 返回的内容不是有效的解析结果')
  }
  const obj = raw as Record<string, unknown>
  const result: ParsedResume = { name: safeStr(obj['name']).slice(0, 20), contacts: [], sections: [] }

  for (const c of safeArr(obj['contacts'])) {
    if (typeof c !== 'object' || c === null) continue
    const label = safeStr((c as Record<string, unknown>)['label']).slice(0, 10)
    const value = safeStr((c as Record<string, unknown>)['value'])
    if (label || value) result.contacts.push({ label, value })
  }

  const TYPE_SET = new Set<SectionType>(['basicInfo', 'education', 'experience', 'listBlock', 'textBlock'])
  for (const s of safeArr(obj['sections'])) {
    if (typeof s !== 'object' || s === null) continue
    const sec = s as Record<string, unknown>
    const type = safeStr(sec['type']) as SectionType
    if (!TYPE_SET.has(type) || type === 'basicInfo') continue
    const title = safeStr(sec['title']).slice(0, 20) || '未命名板块'
    const section: ParsedSection = { type, title, items: [] }

    if (type === 'education') {
      for (const it of safeArr(sec['items'])) {
        const o = (it ?? {}) as Record<string, unknown>
        section.items.push({
          school: safeStr(o['school']),
          date: safeStr(o['date']),
          degree: safeStr(o['degree']),
          extras: safeArr(o['extras']).map((x) => safeStr(x)).filter(Boolean)
        })
      }
    } else if (type === 'experience') {
      for (const it of safeArr(sec['items'])) {
        const o = (it ?? {}) as Record<string, unknown>
        section.items.push({
          title: safeStr(o['title']),
          date: safeStr(o['date']),
          role: safeStr(o['role']),
          details: safeArr(o['details']).map((x) => safeStr(x)).filter(Boolean)
        })
      }
    } else if (type === 'listBlock') {
      for (const it of safeArr(sec['items'])) {
        const o = (it ?? {}) as Record<string, unknown>
        section.items.push({ label: safeStr(o['label']).slice(0, 10), text: safeStr(o['text']) })
      }
    } else {
      for (const it of safeArr(sec['items'])) {
        const o = (it ?? {}) as Record<string, unknown>
        const text = safeStr(o['text'] ?? o['paragraph'] ?? (typeof it === 'string' ? it : ''))
        if (text) section.items.push({ text })
      }
    }
    result.sections.push(section)
  }
  return result
}
