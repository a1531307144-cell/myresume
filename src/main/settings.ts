import { app, ipcMain } from 'electron'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { AiConfig, AiConfigView } from '../shared/ipc'

/**
 * AI 服务配置（用户自备 API Key）。
 * 安全：只存本机 userData；渲染层永远拿不到完整 Key（只给掩码）；
 * 保存时 Key 为空表示"保留原值"，传 null 表示清除。
 */

const LIMITS = { baseUrl: 300, model: 100, apiKey: 300 } as const

function configFile(): string {
  return join(app.getPath('userData'), 'ai-config.json')
}

function sanitize(raw: unknown): AiConfig {
  const obj = (raw ?? {}) as Record<string, unknown>
  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
  return {
    baseUrl: str(obj['baseUrl'], LIMITS.baseUrl),
    model: str(obj['model'], LIMITS.model),
    apiKey: str(obj['apiKey'], LIMITS.apiKey)
  }
}

async function loadConfig(): Promise<AiConfig> {
  try {
    return sanitize(JSON.parse(await readFile(configFile(), 'utf-8')))
  } catch {
    return { baseUrl: '', model: '', apiKey: '' }
  }
}

function maskKey(key: string): string {
  if (!key) return ''
  if (key.length <= 8) return '••••'
  return `${key.slice(0, 4)}••••${key.slice(-4)}`
}

export function registerSettingsIpc(): void {
  ipcMain.handle('ai:getConfig', async (): Promise<AiConfigView> => {
    const c = await loadConfig()
    return { baseUrl: c.baseUrl, model: c.model, hasKey: Boolean(c.apiKey), keyMasked: maskKey(c.apiKey) }
  })

  ipcMain.handle('ai:setConfig', async (_e, patch: unknown) => {
    const p = (patch ?? {}) as Record<string, unknown>
    const current = await loadConfig()
    const next: AiConfig = {
      baseUrl: typeof p['baseUrl'] === 'string' ? p['baseUrl'].trim().slice(0, LIMITS.baseUrl) : current.baseUrl,
      model: typeof p['model'] === 'string' ? p['model'].trim().slice(0, LIMITS.model) : current.model,
      apiKey: current.apiKey
    }
    if (typeof p['apiKey'] === 'string' && p['apiKey'].length > 0) {
      next.apiKey = p['apiKey'].trim().slice(0, LIMITS.apiKey)
    } else if (p['apiKey'] === null) {
      next.apiKey = '' // 显式清除
    }
    await writeFile(configFile(), JSON.stringify(next), 'utf-8')
  })
}

/** 供 aiService 使用（不离开主进程） */
export async function getAiConfig(): Promise<AiConfig> {
  return loadConfig()
}
