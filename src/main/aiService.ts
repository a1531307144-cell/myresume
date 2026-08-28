import { ipcMain } from 'electron'
import type { AiParseResult } from '../shared/ipc'
import { normalizeAiParsed } from '../shared/importer'
import { getAiConfig } from './settings'

/**
 * AI 解析代理：渲染进程把纯文本交上来，主进程调用用户自配的
 * OpenAI 兼容接口，返回校验后的结构化结果。
 *
 * 安全：
 * - 仅允许 https:// 接口（Key 不走明文 HTTP）
 * - 文本长度钳制、响应体大小限制（5MB）、30 秒超时
 * - Key 不写日志、不出主进程
 */

const MAX_TEXT_CHARS = 20000
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024
const TIMEOUT_MS = 30_000

const SYSTEM_PROMPT = `你是简历解析助手。把用户提供的简历文本解析为 JSON，严格输出以下结构，不要输出任何其他内容：
{
  "name": "姓名",
  "contacts": [{"label": "电话|邮箱|微信等", "value": "..."}],
  "sections": [
    { "title": "板块标题（用原文）", "type": "education", "items": [{ "school": "", "date": "", "degree": "", "extras": ["补充行"] }] },
    { "title": "", "type": "experience", "items": [{ "title": "", "date": "", "role": "", "details": ["条目内容"] }] },
    { "title": "", "type": "listBlock", "items": [{ "label": "可为空", "text": "" }] },
    { "title": "", "type": "textBlock", "items": [{ "text": "一段文字" }] }
  ]
}
type 只能是 education / experience / listBlock / textBlock 之一。
实习、工作、项目、研究、校园经历都用 experience；证书、技能、荣誉奖项用 listBlock；自我评价用 textBlock。
缺失的字段用空字符串或空数组，不要编造简历里没有的内容。`

function buildUserPrompt(text: string): string {
  const clipped = text.length > MAX_TEXT_CHARS ? `${text.slice(0, MAX_TEXT_CHARS)}\n（后文已截断）` : text
  return `请解析以下简历文本：\n\n${clipped}`
}

export function registerAiIpc(): void {
  ipcMain.handle('ai:parse', async (_e, payload: unknown): Promise<AiParseResult> => {
    const text = typeof (payload as { text?: unknown })?.['text'] === 'string' ? (payload as { text: string }).text : ''
    if (!text.trim()) return { ok: false, error: '没有可解析的文本内容' }

    const config = await getAiConfig()
    if (!config.baseUrl || !config.model || !config.apiKey) {
      return { ok: false, error: '尚未配置 AI 服务，请先在「AI 设置」中填写' }
    }
    let url: URL
    try {
      url = new URL(config.baseUrl)
      if (url.protocol !== 'https:') throw new Error('非 HTTPS')
    } catch {
      return { ok: false, error: '接口地址无效（必须是以 https:// 开头的完整地址）' }
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      const res = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: config.model,
          temperature: 0.1,
          stream: false,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: buildUserPrompt(text) }
          ]
        })
      })

      const raw = await res.text()
      if (raw.length > MAX_RESPONSE_BYTES) return { ok: false, error: 'AI 服务返回内容过大' }
      if (!res.ok) {
        const hint = res.status === 401 ? '（API Key 可能不正确）' : res.status === 429 ? '（请求过于频繁或额度不足）' : ''
        return { ok: false, error: `AI 服务返回错误 ${res.status}${hint}` }
      }

      let content = ''
      try {
        const json = JSON.parse(raw) as { choices?: { message?: { content?: unknown } }[] }
        content = typeof json.choices?.[0]?.message?.content === 'string' ? json.choices[0]!.message!.content! : ''
      } catch {
        return { ok: false, error: 'AI 服务返回了无法理解的内容' }
      }
      if (!content.trim()) return { ok: false, error: 'AI 返回内容为空' }

      // 剥掉可能的 ```json 围栏
      const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
      let parsedJson: unknown
      try {
        parsedJson = JSON.parse(cleaned)
      } catch {
        return { ok: false, error: 'AI 返回的不是有效 JSON，请重试一次' }
      }

      const parsed = normalizeAiParsed(parsedJson)
      if (parsed.sections.length === 0 && !parsed.name) {
        return { ok: false, error: 'AI 未能从文本中识别出简历内容' }
      }
      return { ok: true, parsed }
    } catch (err) {
      const msg = err instanceof Error && err.name === 'AbortError' ? 'AI 服务响应超时（30 秒）' : '无法连接 AI 服务，请检查网络与接口地址'
      return { ok: false, error: msg }
    } finally {
      clearTimeout(timer)
    }
  })

  // 设置页「测试连接」：发一个极小请求验证配置
  ipcMain.handle('ai:test', async (): Promise<{ ok: boolean; error?: string }> => {
    const config = await getAiConfig()
    if (!config.baseUrl || !config.model || !config.apiKey) return { ok: false, error: '请先填写完整配置' }
    try {
      const url = new URL(config.baseUrl)
      if (url.protocol !== 'https:') return { ok: false, error: '接口地址必须是 https:// 开头' }
      const res = await fetch(url, {
        method: 'POST',
        signal: AbortSignal.timeout(15_000),
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
        body: JSON.stringify({
          model: config.model,
          max_tokens: 8,
          messages: [{ role: 'user', content: '回复"OK"两个字母即可' }]
        })
      })
      if (res.ok) return { ok: true }
      if (res.status === 401) return { ok: false, error: '认证失败：请检查 API Key' }
      if (res.status === 404) return { ok: false, error: '接口地址不存在：请检查地址是否为完整的 …/chat/completions' }
      return { ok: false, error: `服务返回 ${res.status}` }
    } catch {
      return { ok: false, error: '连接失败：请检查网络与接口地址' }
    }
  })
}
