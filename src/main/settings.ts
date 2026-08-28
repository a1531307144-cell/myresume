import { app, ipcMain } from 'electron'
import { randomUUID } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { AiConfigView, AiProfile, AiProfilePatch } from '../shared/ipc'

/**
 * AI 模型配置管理（多模型档案）。
 * 安全：只存本机 userData；渲染层永远拿不到完整 Key（只给掩码）；
 * 保存补丁的 apiKey：空/缺省=保留原值，null=清除。
 * 旧版单模型配置自动迁移为一个「默认」档案。
 */

const LIMITS = { name: 30, baseUrl: 300, model: 100, apiKey: 300, profiles: 10 } as const

interface StoredConfig {
  version: 2
  profiles: AiProfile[]
  activeId: string
}

function configFile(): string {
  return join(app.getPath('userData'), 'ai-config.json')
}

function clamp(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : ''
}

function sanitizeProfile(raw: unknown): AiProfile | null {
  const o = (raw ?? {}) as Record<string, unknown>
  const baseUrl = clamp(o['baseUrl'], LIMITS.baseUrl)
  const model = clamp(o['model'], LIMITS.model)
  if (!baseUrl || !model) return null
  return {
    id: clamp(o['id'], 64) || randomUUID(),
    name: clamp(o['name'], LIMITS.name) || `${model}（${new URL(baseUrl).hostname}）`,
    baseUrl,
    model,
    apiKey: clamp(o['apiKey'], LIMITS.apiKey)
  }
}

function sanitizeConfig(raw: unknown): StoredConfig {
  const o = (raw ?? {}) as Record<string, unknown>
  // 旧版 v1 单模型 → 迁移
  if (typeof o['baseUrl'] === 'string' && o['baseUrl'] && !Array.isArray(o['profiles'])) {
    const migrated = sanitizeProfile({ name: '默认', baseUrl: o['baseUrl'], model: o['model'], apiKey: o['apiKey'] })
    if (migrated) return { version: 2, profiles: [migrated], activeId: migrated.id }
  }
  const profiles = (Array.isArray(o['profiles']) ? o['profiles'] : [])
    .map(sanitizeProfile)
    .filter((p): p is AiProfile => p !== null)
    .slice(0, LIMITS.profiles)
  const activeId = clamp(o['activeId'], 64)
  return {
    version: 2,
    profiles,
    activeId: profiles.some((p) => p.id === activeId) ? activeId : (profiles[0]?.id ?? '')
  }
}

async function loadConfig(): Promise<StoredConfig> {
  try {
    return sanitizeConfig(JSON.parse(await readFile(configFile(), 'utf-8')))
  } catch {
    return { version: 2, profiles: [], activeId: '' }
  }
}

async function saveConfig(config: StoredConfig): Promise<void> {
  await writeFile(configFile(), JSON.stringify(config), 'utf-8')
}

function maskKey(key: string): string {
  if (!key) return ''
  if (key.length <= 8) return '••••'
  return `${key.slice(0, 4)}••••${key.slice(-4)}`
}

function toView(config: StoredConfig): AiConfigView {
  return {
    profiles: config.profiles.map((p) => ({
      id: p.id,
      name: p.name,
      baseUrl: p.baseUrl,
      model: p.model,
      hasKey: Boolean(p.apiKey),
      keyMasked: maskKey(p.apiKey)
    })),
    activeId: config.activeId
  }
}

export function registerSettingsIpc(): void {
  ipcMain.handle('ai:getConfig', async (): Promise<AiConfigView> => toView(await loadConfig()))

  ipcMain.handle('ai:saveProfile', async (_e, patch: unknown): Promise<{ ok: boolean; error?: string; id?: string }> => {
    const p = (patch ?? {}) as Record<string, unknown>
    const baseUrl = clamp(p['baseUrl'], LIMITS.baseUrl)
    const model = clamp(p['model'], LIMITS.model)
    const name = clamp(p['name'], LIMITS.name)
    if (!baseUrl) return { ok: false, error: '请填写接口地址' }
    try {
      const u = new URL(baseUrl)
      if (u.protocol !== 'https:') return { ok: false, error: '接口地址必须以 https:// 开头' }
    } catch {
      return { ok: false, error: '接口地址格式无效' }
    }
    if (!model) return { ok: false, error: '请填写模型名称' }

    const config = await loadConfig()
    const apiKey = p['apiKey']
    const id = clamp(p['id'], 64)
    const existing = id ? config.profiles.find((x) => x.id === id) : undefined

    if (existing) {
      existing.name = name || existing.name
      existing.baseUrl = baseUrl
      existing.model = model
      if (typeof apiKey === 'string' && apiKey.length > 0) existing.apiKey = apiKey.trim().slice(0, LIMITS.apiKey)
      else if (apiKey === null) existing.apiKey = ''
    } else {
      if (config.profiles.length >= LIMITS.profiles) return { ok: false, error: '最多保存 10 个模型配置' }
      const profile: AiProfile = {
        id: randomUUID(),
        name: name || model, // 未命名时用模型名兜底
        baseUrl,
        model,
        apiKey: typeof apiKey === 'string' ? apiKey.trim().slice(0, LIMITS.apiKey) : ''
      }
      config.profiles.push(profile)
      if (!config.activeId) config.activeId = profile.id
    }

    await saveConfig(config)
    const target = existing ?? config.profiles[config.profiles.length - 1]!
    return { ok: true, id: target.id }
  })

  ipcMain.handle('ai:deleteProfile', async (_e, id: unknown): Promise<void> => {
    const config = await loadConfig()
    config.profiles = config.profiles.filter((p) => p.id !== id)
    if (config.activeId === id) config.activeId = config.profiles[0]?.id ?? ''
    await saveConfig(config)
  })

  ipcMain.handle('ai:setActive', async (_e, id: unknown): Promise<void> => {
    const config = await loadConfig()
    if (config.profiles.some((p) => p.id === id)) {
      config.activeId = String(id)
      await saveConfig(config)
    }
  })
}

/** 供 aiService 使用（不离开主进程） */
export async function getAiProfiles(): Promise<{ profiles: AiProfile[]; activeId: string }> {
  const c = await loadConfig()
  return { profiles: c.profiles, activeId: c.activeId }
}
