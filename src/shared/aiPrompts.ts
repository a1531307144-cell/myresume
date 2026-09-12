import type {
  BasicInfoData,
  EducationData,
  ExperienceData,
  ListBlockData,
  ResumeDocument,
  Section,
  SectionData,
  SectionType,
  TextBlockData
} from './schema'
import { uid } from './id'

/**
 * AI 任务的提示词与输出校验（纯函数，无 UI / 无 Node 依赖，vitest 覆盖）。
 *
 * 设计要点：
 * - 只润色「描述性文字」，事实字段（时间/学校/单位/职务/标签）一律照抄
 * - 输出用「@@序号 分组 + 行」的纯文本协议：既能边生成边显示可读文字，
 *   又能和 schema 里「一行一条」的字符串数组一一对应
 * - 模型输出一律视为不可信：条数对不上、单行过长、全空 → 直接报错，绝不猜测映射
 */

export type AiTaskName = 'parse-resume' | 'section-rewrite' | 'section-generate' | 'diagnose'

/** 单行上限（超过几乎一定是模型跑飞了；宁可报错也不截断——截断会静默损坏内容） */
const MAX_LINE_CHARS = 500
const MAX_LINES_PER_GROUP = 40
const MAX_GROUPS = 20
const MAX_TOTAL_CHARS = 40_000

// ———————————————— 通用上下文 ————————————————

/** 求职意向就存在「基本信息」板块的联系方式里（label 含「求职意向」等词），不新增字段 */
const JOB_LABELS = ['求职意向', '求职方向', '意向岗位', '目标岗位', '应聘岗位', '求职目标']

function basicInfoData(doc: ResumeDocument | undefined): BasicInfoData | undefined {
  const basic = doc?.sections.find((s) => s.type === 'basicInfo')
  return basic?.data as BasicInfoData | undefined
}

export function readJobTarget(doc: ResumeDocument | undefined): string {
  const data = basicInfoData(doc)
  const hit = data?.contacts?.find((c) => JOB_LABELS.some((k) => (c.label ?? '').includes(k)))
  return (hit?.value ?? '').trim()
}

export function readName(doc: ResumeDocument | undefined): string {
  return (basicInfoData(doc)?.name ?? '').trim()
}

/**
 * 跨进程传给主进程前先「瘦身」：照片 base64 可能有几百 KB，
 * 而 AI 任务只需要姓名、求职意向这些文字，没必要把照片一起搬过去。
 */
export function slimDoc(doc: ResumeDocument): ResumeDocument {
  return {
    ...doc,
    sections: doc.sections.map((s) =>
      s.type === 'basicInfo'
        ? { ...s, data: { ...(s.data as BasicInfoData), photo: null } }
        : s
    )
  }
}

/** 板块类型的中文名（用于提示词里说明这是什么板块） */
export function typeLabel(type: SectionType): string {
  switch (type) {
    case 'education':
      return '教育经历'
    case 'experience':
      return '经历（实习/工作/项目/研究/校园）'
    case 'listBlock':
      return '条目列表（技能、证书、荣誉奖项等）'
    case 'textBlock':
      return '整段文字（如自我评价）'
    default:
      return '基本信息'
  }
}

/** 板块里有几个可润色的「单位」：经历=条目，列表=条目，整段=段落 */
export function unitCount(section: Section): number {
  const d = section.data as { items?: unknown[]; entries?: unknown[]; paragraphs?: unknown[] }
  return d.items?.length ?? d.entries?.length ?? d.paragraphs?.length ?? 0
}

/** 把板块内容摊平成「第 N 条」的编号原文，供提示词使用 */
export function sectionToAiText(section: Section): string {
  const out: string[] = []
  if (section.type === 'experience') {
    const items = (section.data as ExperienceData).items ?? []
    items.forEach((it, i) => {
      const head = [it.date, it.title, it.role].filter((x) => x && x.trim()).join(' | ')
      out.push(`第 ${i + 1} 条：${head || '（未填标题）'}`)
      for (const line of it.details ?? []) out.push(`- ${line}`)
    })
  } else if (section.type === 'education') {
    const items = (section.data as EducationData).items ?? []
    items.forEach((it, i) => {
      const head = [it.date, it.school, it.degree].filter((x) => x && x.trim()).join(' | ')
      out.push(`第 ${i + 1} 条：${head || '（未填学校）'}`)
      for (const line of it.extras ?? []) out.push(`- ${line}`)
    })
  } else if (section.type === 'listBlock') {
    const entries = (section.data as ListBlockData).entries ?? []
    entries.forEach((e, i) => {
      out.push(`第 ${i + 1} 条：${e.label ? `${e.label}：` : ''}${e.text}`)
    })
  } else if (section.type === 'textBlock') {
    const paragraphs = (section.data as TextBlockData).paragraphs ?? []
    paragraphs.forEach((p, i) => {
      out.push(`第 ${i + 1} 段：`)
      out.push(p)
    })
  }
  return out.join('\n')
}

/**
 * 全文诊断用的精简摘要：剔除照片（base64 可达数百 KB），逐段限长，
 * 超预算就从头保留、丢弃靠后的板块，并如实标记 truncated。
 */
export function condenseResumeForDiagnosis(
  doc: ResumeDocument,
  maxChars = 12000
): { text: string; truncated: boolean; totalSections: number; includedSections: number } {
  const blocks: string[] = []
  const sections = doc.sections.filter((s) => s.type !== 'basicInfo')
  const name = readName(doc)
  const jobTarget = readJobTarget(doc)

  const basic = ['[基本信息]', `姓名：${name || '（未填写）'}`, `求职意向：${jobTarget || '（未填写）'}`].join('\n')
  blocks.push(basic)

  for (const s of sections) {
    const body = sectionToAiText(s)
      .split('\n')
      .map((l) => (l.length > 200 ? `${l.slice(0, 200)}…` : l))
      .join('\n')
    blocks.push(`[${s.id}] ${s.title}（${typeLabel(s.type)}）\n${body || '（本板块为空）'}`)
  }

  // 逐个累加，超预算就停在能装下的地方
  const kept: string[] = []
  let used = 0
  for (const b of blocks) {
    if (used + b.length + 2 > maxChars && kept.length > 1) break
    kept.push(b)
    used += b.length + 2
  }
  const totalSections = sections.length
  const includedSections = Math.max(0, kept.length - 1)
  return {
    text: kept.join('\n\n'),
    truncated: includedSections < totalSections,
    totalSections,
    includedSections
  }
}

// ———————————————— 提示词 ————————————————

const PREAMBLE = `你是一位资深中文简历写作顾问，服务对象是中国大陆法学院学生与法律行业求职者（律所、公司法务、公检法、仲裁机构）。你的读者是律所 HR 与合伙人律师，他们初筛一份简历只用几秒钟。

必须遵守的铁律：
1. 绝不编造事实。不得新增原文没有的单位、时间、职务、数字、奖项、案件或客户名称。
2. 每条以动词开头，写清「做了什么、产生什么结果」，不要写「负责……」这类空泛职责。
3. 原文里的数字（案卷份数、标的额、人数、排名、奖项等级）必须原样保留，并尽量前置。
4. 只有在明显需要量化、而原文确实没给数字时，才用 XXX 占位（例：整理案卷 XXX 份），让用户自己补。不要为了凑数字而到处加 XXX。
5. 使用法律行业的标准说法：案卷整理、法律检索、合同审查、尽职调查、法律意见书、证据目录、庭审、诉讼／非诉、类案检索等，不生造词。
6. 语言克制、书面、专业。不用「我」「非常」「极大地」这类词，不用感叹号，不用 emoji。
7. 不抬高事实：不把「协助」写成「独立负责」，不把「参与」写成「主办」。`

const REWRITE_RULES = `【本次任务】改写用户给出的简历内容。
输出规则（必须严格遵守）：
- 只输出改写后的内容本身，不要任何解释、前言、结语、点评。
- 不要使用 Markdown 代码块，不要加粗、不要标题符号。
- 原文有几条就输出几组，顺序与原文完全一致，不多不少。
- 每组以单独一行的 @@序号 开头（@@1、@@2 ……）。
- 组内每一行以「- 」开头，一行对应原文的一行；不要合并要点，也不要拆分要点。`

const GENERATE_RULES = `【本次任务】用户要新建一个板块，但还不知道怎么写。你会拿到用户对几个问题的回答，请据此从零写出这个板块的内容。
输出规则（必须严格遵守）：
- 只输出内容本身，不要解释、不要寒暄、不要 Markdown 代码块。
- 一组对应一条内容（一条经历／一条条目／一个段落），输出 1 到 3 组。
- 每组以单独一行的 @@序号 开头（@@1、@@2 ……）。
- 信息少就写得概括、稳妥。宁可少写，也绝不编造具体单位、时间、职务或数字。
- 用户没提供的事实（单位名、时间、职务），对应那一行留空，不要臆造。`

export function buildRewriteSystemPrompt(): string {
  return `${PREAMBLE}\n\n${REWRITE_RULES}`
}

export function buildRewriteUserPrompt(params: {
  section: Section
  instruction: string
  doc: ResumeDocument
}): string {
  const { section, instruction, doc } = params
  const n = unitCount(section)
  return [
    `【求职意向】${readJobTarget(doc) || '（未填写）'}`,
    `【目标行业】中国大陆法律行业（律所／公司法务／公检法／仲裁）`,
    '',
    `【板块】${section.title}（${typeLabel(section.type)}）`,
    `【用户要求】${instruction.trim() || '（未填写：请在事实完全不变的前提下，让表达更通顺、更专业、更贴合上述求职意向）'}`,
    '',
    '【原文】',
    sectionToAiText(section),
    '',
    `【输出】请输出 ${n} 组，依次以 @@1 … @@${n} 开头。`,
    '再次强调：不得新增原文没有的事实、数字、单位、时间、职务或奖项。'
  ].join('\n')
}

export function buildGenerateSystemPrompt(): string {
  return `${PREAMBLE}\n\n${GENERATE_RULES}`
}

/** 从零写时，不同板块要求的事实标签行不同 */
function generateTypeRule(type: SectionType): string {
  switch (type) {
    case 'experience':
      return '每组前三行依次为「单位：」「时间：」「职务：」，之后每行一条「- 具体做了什么」。用户没说的标签行留空。'
    case 'education':
      return '每组前三行依次为「学校：」「时间：」「学位：」，之后每行一条「- 补充信息（如 GPA、排名、核心课程）」。用户没说的标签行留空。'
    case 'listBlock':
      return '每组只写一行，格式为「标签：内容」（例：法律职业资格证：2025 年通过）。标签不确定就留空，只写内容。'
    case 'textBlock':
      return '每组写一个自然段，直接写正文，不要任何标签行、不要「- 」符号。'
    default:
      return '直接写内容。'
  }
}

export function buildGenerateUserPrompt(params: {
  section: Section
  answers: string
  doc: ResumeDocument
}): string {
  const { section, answers, doc } = params
  return [
    `【求职意向】${readJobTarget(doc) || '（未填写）'}`,
    `【目标行业】中国大陆法律行业（律所／公司法务／公检法／仲裁）`,
    '',
    `【板块】${section.title}（${typeLabel(section.type)}）`,
    '',
    '【用户提供的信息】',
    answers.trim() || '（用户几乎没提供信息：请写得概括、稳妥，宁可少写也不要编造）',
    '',
    '【输出格式】',
    generateTypeRule(section.type)
  ].join('\n')
}

export function buildDiagnoseSystemPrompt(): string {
  return `你是中文法律行业简历的审阅专家，服务对象是正在求职的中国法学院学生。你的任务是找出这份简历里具体、可修改的问题，并给出可执行的修改方向。
只输出 JSON，不要输出任何其他文字，不要使用 Markdown 代码块。

判断标准，按重要性排序：
1. 定位匹配：内容是否与「求职意向」相符；是否缺少法律行业最看重的东西（法律职业资格、律所／法院实习、具体案件类型、可量化成果）。
2. 表达质量：是否只写职责不写成果、是否流水账、用词是否外行、是否冗长重复。
3. 结构完整：板块顺序是否合理、是否缺少该有的板块。
4. 低级问题：时间格式不统一、错别字、中英文标点混用。

硬性要求：
- 每个问题必须指向给定的板块 id 与条目序号；sectionId 只能从用户给出的 id 里选，不得编造。
- 不允许输出「整体不错」「继续加油」这类空话。
- 最多 8 个问题，按严重程度从高到低排列。
- suggestion 只给修改方向，不要直接给出成稿。`
}

export function buildDiagnoseUserPrompt(doc: ResumeDocument): { text: string; truncated: boolean; totalSections: number; includedSections: number } {
  const c = condenseResumeForDiagnosis(doc)
  const lines = [
    `【求职意向】${readJobTarget(doc) || '（未填写）'}`,
    `【姓名】${readName(doc) || '（未填写）'}`,
    c.truncated ? '【注意】简历过长，以下只包含靠前的若干板块；请在 summary 里说明这一点。' : '',
    '',
    '【简历内容】方括号内是板块 id，条目序号从 1 开始',
    c.text,
    '',
    '【输出 JSON 结构】',
    '{',
    '  "summary": "一句话总体判断，40 字以内",',
    '  "issues": [',
    '    { "sectionId": "板块 id", "itemIndex": 1, "severity": "high",',
    '      "problem": "具体问题，30 字以内", "suggestion": "怎么改，40 字以内" }',
    '  ]',
    '}',
    'severity 只能是 high / medium / low；itemIndex 为 0 表示整个板块。'
  ]
  // 注意：不能直接展开 c —— c.text 会覆盖上面拼好的整段提示词
  return {
    text: lines.filter((l) => l !== '').join('\n'),
    truncated: c.truncated,
    totalSections: c.totalSections,
    includedSections: c.includedSections
  }
}

// ———————————————— 输出解析与校验 ————————————————

/** 剥掉模型爱加的 ``` 代码围栏 */
function stripFence(raw: string): string {
  return raw
    .replace(/^\s*```[a-zA-Z]*\s*\n?/, '')
    .replace(/\n?```\s*$/, '')
    .trim()
}

/** 行首各种项目符号 / 编号，一律容错剥掉 */
function stripBullet(line: string): string {
  return line
    .replace(/^\s*(?:[-•*·●○▪]\s*|\d+\s*[.、)．]\s*)/, '')
    .trim()
}

const GROUP_MARK = /^\s*@{1,3}\s*(\d+)\s*$/

/**
 * 解析「@@序号 + 行」的分组输出。
 * expectedUnits 不为 null 时，组数必须完全相等——对不上就报错，绝不猜测映射。
 */
export function parseGroups(raw: string, expectedUnits: number | null): string[][] {
  const text = stripFence(raw)
  if (!text) throw new Error('AI 返回内容为空')

  const lines = text.split(/\r?\n/)
  const groups: string[][] = []
  let current: string[] | null = null
  let markerCount = 0

  for (const line of lines) {
    const m = line.match(GROUP_MARK)
    if (m) {
      markerCount += 1
      current = []
      groups.push(current)
      continue
    }
    if (current === null) continue // 跳过 @@1 之前的开场白
    const body = stripBullet(line)
    if (!body) continue
    if (body.length > MAX_LINE_CHARS) {
      throw new Error(`AI 返回的内容异常（单行超过 ${MAX_LINE_CHARS} 字），已放弃本次修改`)
    }
    current.push(body)
  }

  // 模型完全没写标记时：只有一条内容的情况仍可接受（整段当作唯一一组）
  if (markerCount === 0) {
    const only = lines.map(stripBullet).filter(Boolean)
    if (expectedUnits !== null && expectedUnits > 1) {
      throw new Error(`AI 没有按格式分组（原文有 ${expectedUnits} 条），已放弃本次修改`)
    }
    if (only.length === 0) throw new Error('AI 返回内容为空')
    return [only]
  }

  const filled = groups.filter((g) => g.length > 0)
  if (filled.length === 0) throw new Error('AI 返回内容为空')

  if (expectedUnits !== null && filled.length !== expectedUnits) {
    throw new Error(`AI 返回了 ${filled.length} 条，与原文的 ${expectedUnits} 条对不上，已放弃本次修改`)
  }
  if (filled.length > MAX_GROUPS) throw new Error('AI 返回的条数过多，已放弃本次修改')
  for (const g of filled) {
    if (g.length > MAX_LINES_PER_GROUP) {
      throw new Error(`AI 返回的内容异常（单条超过 ${MAX_LINES_PER_GROUP} 行），已放弃本次修改`)
    }
  }
  const total = filled.reduce((n, g) => n + g.reduce((m, l) => m + l.length, 0), 0)
  if (total > MAX_TOTAL_CHARS) throw new Error('AI 返回的内容过大，已放弃本次修改')

  return filled
}

/** 解析结果：把某一组里的「标签：值」行拆出来 */
function splitLabels(group: string[]): { labels: Record<string, string>; rest: string[] } {
  const labels: Record<string, string> = {}
  const rest: string[] = []
  for (const line of group) {
    const m = line.match(/^([^：:]{1,8})[：:]\s*(.*)$/)
    if (m && /^(单位|公司|学校|院校|时间|日期|职务|职位|岗位|学位|学历|专业|标签)$/.test(m[1]!.trim())) {
      labels[m[1]!.trim()] = m[2]!.trim()
    } else {
      rest.push(line)
    }
  }
  return { labels, rest }
}

function pick(labels: Record<string, string>, keys: string[]): string {
  for (const k of keys) {
    const v = labels[k]
    if (v) return v
  }
  return ''
}

/**
 * 润色结果写回：只改描述性字段，事实字段（时间/学校/单位/职务/标签）保持原样。
 * 返回**新的** data 对象，由调用方决定何时替换（采纳前不动文档）。
 */
export function applyRewrite(section: Section, groups: string[][]): SectionData {
  switch (section.type) {
    case 'experience': {
      const data = section.data as ExperienceData
      return {
        items: data.items.map((it, i) => ({ ...it, details: groups[i] ?? it.details }))
      } as ExperienceData
    }
    case 'education': {
      const data = section.data as EducationData
      return {
        items: data.items.map((it, i) => ({ ...it, extras: groups[i] ?? it.extras }))
      } as EducationData
    }
    case 'listBlock': {
      const data = section.data as ListBlockData
      return {
        entries: data.entries.map((e, i) => ({ ...e, text: groups[i] ? groups[i]!.join(' ') : e.text }))
      } as ListBlockData
    }
    case 'textBlock': {
      const data = section.data as TextBlockData
      return {
        paragraphs: data.paragraphs.map((p, i) => (groups[i] ? groups[i]!.join('\n') : p))
      } as TextBlockData
    }
    default:
      throw new Error('这个板块不支持 AI 改写')
  }
}

/** 从零生成的结果转成新的 data 对象 */
export function applyGenerate(section: Section, groups: string[][]): SectionData {
  switch (section.type) {
    case 'experience': {
      return {
        items: groups.map((g) => {
          const { labels, rest } = splitLabels(g)
          return {
            id: uid(),
            title: pick(labels, ['单位', '公司']),
            date: pick(labels, ['时间', '日期']),
            role: pick(labels, ['职务', '职位', '岗位']),
            details: rest
          }
        })
      } as ExperienceData
    }
    case 'education': {
      return {
        items: groups.map((g) => {
          const { labels, rest } = splitLabels(g)
          return {
            id: uid(),
            school: pick(labels, ['学校', '院校', '单位']),
            degree: pick(labels, ['学位', '学历', '专业']),
            date: pick(labels, ['时间', '日期']),
            extras: rest
          }
        })
      } as EducationData
    }
    case 'listBlock': {
      return {
        entries: groups.map((g) => {
          const line = g.join(' ')
          const m = line.match(/^([^：:]{1,12})[：:]\s*(.*)$/)
          return m ? { id: uid(), label: m[1]!.trim(), text: m[2]!.trim() } : { id: uid(), label: '', text: line }
        })
      } as ListBlockData
    }
    case 'textBlock': {
      return { paragraphs: groups.map((g) => g.join('\n')) } as TextBlockData
    }
    default:
      throw new Error('这个板块不支持 AI 生成')
  }
}

// ———————————————— 诊断结果 ————————————————

export interface AiIssue {
  sectionId: string
  sectionTitle: string
  /** 0 = 整个板块 */
  itemIndex: number
  severity: 'high' | 'medium' | 'low'
  problem: string
  suggestion: string
}

export interface AiDiagnosis {
  summary: string
  issues: AiIssue[]
}

function clampText(v: unknown, max: number): string {
  if (typeof v !== 'string') return ''
  const t = v.trim()
  return t.length > max ? `${t.slice(0, max)}…` : t
}

/** 校验诊断 JSON：指向不存在的板块 id 一律丢弃（幻觉 id 不能用来跳转） */
export function parseDiagnosis(raw: string, sections: Section[]): AiDiagnosis {
  let json: unknown
  try {
    json = JSON.parse(stripFence(raw))
  } catch {
    throw new Error('AI 返回的不是有效的诊断结果，请重试一次')
  }
  const obj = json as { summary?: unknown; issues?: unknown }
  const byId = new Map(sections.map((s) => [s.id, s]))
  const rawIssues = Array.isArray(obj?.issues) ? obj.issues : []
  const sevRank = { high: 0, medium: 1, low: 2 } as const

  const issues: AiIssue[] = []
  for (const item of rawIssues.slice(0, 20)) {
    const o = (item ?? {}) as Record<string, unknown>
    const sectionId = typeof o['sectionId'] === 'string' ? o['sectionId'] : ''
    const section = byId.get(sectionId)
    if (!section) continue // 幻觉 id：丢弃
    const problem = clampText(o['problem'], 60)
    if (!problem) continue
    const sev = o['severity']
    const severity = sev === 'high' || sev === 'medium' || sev === 'low' ? sev : 'medium'
    const idx = typeof o['itemIndex'] === 'number' && Number.isFinite(o['itemIndex']) ? Math.max(0, Math.floor(o['itemIndex'])) : 0
    issues.push({
      sectionId,
      sectionTitle: section.title,
      itemIndex: idx,
      severity,
      problem,
      suggestion: clampText(o['suggestion'], 80)
    })
  }

  issues.sort((a, b) => sevRank[a.severity] - sevRank[b.severity])
  return { summary: clampText(obj?.summary, 60), issues: issues.slice(0, 8) }
}
