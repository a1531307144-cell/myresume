import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { copyFile, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { basename, join } from 'node:path'
import { loadMigrate } from '../shared/migrate'
import type { ResumeDocument } from '../shared/schema'
import type { OpenResult, RecentItem, SaveResult } from '../shared/ipc'

/**
 * 文件服务（单窗口多标签）：每个**标签**一份独立会话（当前文件路径 + 脏标记），
 * 路径只存在主进程（最小权限路径模型）。
 * 原子写（.tmp → rename）杜绝半写损坏；覆盖前自动备份（每文档保留 5 份）；
 * 防丢草稿按文档 id 一份（autorecover/<docId>.json），多标签互不覆盖。
 */

interface WindowSession {
  filePath: string | null
  dirty: boolean
}

/** 会话键：`${webContents.id}:${tabId}` —— 同一窗口内每个标签彼此隔离 */
const sessions = new Map<string, WindowSession>()

let recentCache: RecentItem[] = []
let recentChangedCb: (() => void) | null = null

const FILE_FILTER = { name: '我的简历文档', extensions: ['myresume', 'json'] }

function userDataDir(): string {
  return app.getPath('userData')
}

function backupsDir(): string {
  return join(userDataDir(), 'backups')
}

function autorecoverDir(): string {
  return join(userDataDir(), 'autorecover')
}

function recentFile(): string {
  return join(userDataDir(), 'recent.json')
}

function sessionKey(webContentsId: number, tabId: string): string {
  return `${webContentsId}:${tabId}`
}

function sessionFor(sender: Electron.WebContents, tabId: string): WindowSession {
  const key = sessionKey(sender.id, tabId)
  let s = sessions.get(key)
  if (!s) {
    s = { filePath: null, dirty: false }
    sessions.set(key, s)
  }
  return s
}

/** 窗口销毁：清掉它名下所有标签的会话 */
export function destroySession(webContentsId: number): void {
  const prefix = `${webContentsId}:`
  for (const key of [...sessions.keys()]) {
    if (key.startsWith(prefix)) sessions.delete(key)
  }
  activeTabs.delete(webContentsId)
}

/** 关闭标签：丢弃其会话（避免 Map 无限增长） */
export function dropTabSession(webContentsId: number, tabId: string): void {
  sessions.delete(sessionKey(webContentsId, tabId))
}

/** 本窗口**任一**标签有未保存修改（关闭窗口时的拦截依据） */
export function isWindowDirty(win: BrowserWindow): boolean {
  const prefix = `${win.webContents.id}:`
  for (const [key, s] of sessions) {
    if (key.startsWith(prefix) && s.dirty) return true
  }
  return false
}

function focusedWin(): BrowserWindow | undefined {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
}

/** 每个窗口当前激活的标签 id（空串 = 首页）；窗口标题只跟随它 */
const activeTabs = new Map<number, string>()

/**
 * 刷新窗口标题。只有「刚被写入/打开的这个标签就是当前激活标签」时才改标题——
 * 后台标签的自动保存绝不能把标题改成它自己的名字。
 */
function refreshTitle(sender: Electron.WebContents): void {
  const win = BrowserWindow.fromWebContents(sender)
  if (!win) return
  const tabId = activeTabs.get(sender.id) ?? ''
  if (!tabId) {
    win.setTitle('我的简历')
    return
  }
  const s = sessionFor(sender, tabId)
  win.setTitle(`${s.filePath ? basename(s.filePath) : '未命名简历'} — 我的简历`)
}

// ———————————————— 原子写 / 备份 ————————————————

async function atomicWrite(path: string, content: string): Promise<void> {
  const tmp = `${path}.tmp`
  await writeFile(tmp, content, 'utf-8')
  try {
    await rename(tmp, path)
  } catch {
    // Windows 上目标被占用等极端情况：删除后重命名
    await rm(path, { force: true })
    await rename(tmp, path)
  }
}

async function backupExisting(path: string, docId: string): Promise<void> {
  try {
    if (!existsSync(path)) return
    await mkdir(backupsDir(), { recursive: true })
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    await copyFile(path, join(backupsDir(), `${docId}_${stamp}.myresume`))
    // 每文档只保留最近 5 份
    const mine = (await readdir(backupsDir())).filter((f) => f.startsWith(docId)).sort()
    while (mine.length > 5) {
      await rm(join(backupsDir(), mine.shift()!), { force: true })
    }
  } catch (err) {
    console.warn('备份失败（不影响保存）', err)
  }
}

// ———————————————— 最近文件 ————————————————

export function getRecentList(): RecentItem[] {
  return recentCache
}

export function onRecentChanged(cb: () => void): void {
  recentChangedCb = cb
}

async function pushRecent(path: string, updatedAt: string): Promise<void> {
  const filtered = recentCache.filter((i) => i.path !== path)
  filtered.unshift({ path, name: basename(path), updatedAt })
  recentCache = filtered.slice(0, 10)
  try {
    await writeFile(recentFile(), JSON.stringify(recentCache, null, 2), 'utf-8')
  } catch (err) {
    console.warn('最近文件写入失败', err)
  }
  recentChangedCb?.()
}

// ———————————————— 打开 / 保存 ————————————————

async function openPath(
  path: string,
  sender: Electron.WebContents,
  tabId: string,
  pushToRecent = true
): Promise<OpenResult> {
  try {
    const text = await readFile(path, 'utf-8')
    let json: unknown
    try {
      json = JSON.parse(text)
    } catch {
      return { error: '文件已损坏或不是有效的「我的简历」文档' }
    }
    const r = loadMigrate(json)
    if (!r.ok) return { error: r.error }
    const session = sessionFor(sender, tabId)
    session.filePath = path
    session.dirty = false
    if (pushToRecent) await pushRecent(path, r.doc.updatedAt)
    refreshTitle(sender)
    return { path, name: basename(path), doc: r.doc }
  } catch {
    return { error: '无法读取文件（可能已被移动或删除）' }
  }
}

async function writeTo(
  path: string,
  doc: ResumeDocument,
  sender: Electron.WebContents,
  tabId: string
): Promise<SaveResult> {
  try {
    await backupExisting(path, doc.id)
    await atomicWrite(path, JSON.stringify(doc, null, 2))
    const session = sessionFor(sender, tabId)
    session.filePath = path
    session.dirty = false
    await pushRecent(path, doc.updatedAt)
    await rm(join(autorecoverDir(), `${doc.id}.json`), { force: true }) // 已落盘，草稿可清
    await rm(join(userDataDir(), 'autorecover.json'), { force: true }) // 旧版单草稿文件清理
    refreshTitle(sender)
    return { path, name: basename(path) }
  } catch (err) {
    console.error('保存失败', err)
    return { error: '保存失败：无法写入目标位置' }
  }
}

function suggestFileName(doc: ResumeDocument): string {
  const basic = doc.sections.find((s) => s.type === 'basicInfo')
  const data = basic?.data as { name?: string } | undefined
  const name = data?.name?.trim() || '未命名简历'
  return `${name}.myresume`
}

// ———————————————— IPC 注册 ————————————————

export async function initFileService(): Promise<void> {
  try {
    recentCache = JSON.parse(await readFile(recentFile(), 'utf-8'))
  } catch {
    recentCache = []
  }
}

/** 校验渲染层传来的标签 id（会话键以「:」分隔，故禁止出现该字符） */
function asTabId(v: unknown): string {
  return typeof v === 'string' && v.length > 0 && v.length <= 64 && !v.includes(':') ? v : ''
}

export function registerFileIpc(): void {
  ipcMain.handle('file:new', (e, tabId: unknown) => {
    const t = asTabId(tabId)
    if (!t) return
    const s = sessionFor(e.sender, t)
    s.filePath = null
    s.dirty = false
    // 注意：这里**不**改窗口标题——该标签可能不在前台，标题只跟随当前标签
  })

  ipcMain.handle('file:open', async (e, tabId: unknown) => {
    const t = asTabId(tabId)
    if (!t) return { error: '内部错误：标签无效' }
    const win = BrowserWindow.fromWebContents(e.sender) ?? focusedWin()
    if (!win) return { canceled: true }
    const r = await dialog.showOpenDialog(win, {
      title: '打开简历',
      filters: [FILE_FILTER],
      properties: ['openFile']
    })
    if (r.canceled || !r.filePaths[0]) return { canceled: true }
    return openPath(r.filePaths[0], e.sender, t)
  })

  ipcMain.handle('file:openRecent', (e, path: unknown, tabId: unknown) => {
    const t = asTabId(tabId)
    if (!t) return { error: '内部错误：标签无效' }
    if (typeof path !== 'string') return { error: '路径无效' }
    return openPath(path, e.sender, t)
  })

  ipcMain.handle('file:getRecent', () => recentCache)

  ipcMain.handle('file:save', (e, doc: ResumeDocument, tabId: unknown) => {
    const t = asTabId(tabId)
    if (!t) return Promise.resolve({ error: '内部错误：标签无效' })
    const session = sessionFor(e.sender, t)
    if (!session.filePath) {
      return Promise.resolve({ error: '尚未指定保存位置，请先「另存为」' })
    }
    return writeTo(session.filePath, doc, e.sender, t)
  })

  ipcMain.handle('file:saveAs', async (e, doc: ResumeDocument, tabId: unknown) => {
    const t = asTabId(tabId)
    if (!t) return { error: '内部错误：标签无效' }
    const win = BrowserWindow.fromWebContents(e.sender) ?? focusedWin()
    if (!win) return { canceled: true }
    const r = await dialog.showSaveDialog(win, {
      title: '保存简历',
      defaultPath: suggestFileName(doc),
      filters: [FILE_FILTER]
    })
    if (r.canceled || !r.filePath) return { canceled: true }
    let path = r.filePath
    if (!/\.(myresume|json)$/i.test(path)) path += '.myresume'
    return writeTo(path, doc, e.sender, t)
  })

  ipcMain.handle('file:set-dirty', (e, v: unknown, tabId: unknown) => {
    const t = asTabId(tabId)
    if (!t) return
    sessionFor(e.sender, t).dirty = Boolean(v)
  })

  /** 切换标签后刷新窗口标题（首页标签传空串 → 显示应用名） */
  ipcMain.handle('file:set-active-tab', (e, tabId: unknown) => {
    activeTabs.set(e.sender.id, typeof tabId === 'string' ? tabId : '')
    refreshTitle(e.sender)
  })

  /** 关闭标签：丢弃该标签的会话 */
  ipcMain.handle('file:close-tab', (e, tabId: unknown) => {
    const t = asTabId(tabId)
    if (t) dropTabSession(e.sender.id, t)
  })

  // ———— 防丢草稿（按文档 id 一份；仅未保存过的新文档使用） ————
  ipcMain.handle('file:autorecover:save', async (_e, doc: ResumeDocument) => {
    try {
      await mkdir(autorecoverDir(), { recursive: true })
      await atomicWrite(join(autorecoverDir(), `${doc.id}.json`), JSON.stringify(doc))
    } catch (err) {
      console.warn('草稿保存失败', err)
    }
  })

  ipcMain.handle('file:autorecover:read', async () => {
    try {
      const dir = autorecoverDir()
      const files = (await readdir(dir)).filter((f) => f.endsWith('.json'))
      const drafts: { id: string; doc: ResumeDocument; updatedAt: string }[] = []
      for (const f of files) {
        try {
          const parsed = JSON.parse(await readFile(join(dir, f), 'utf-8'))
          if (parsed?.app !== 'MyResume') continue
          drafts.push({
            id: String(parsed.id ?? f.replace(/\.json$/, '')),
            doc: parsed,
            updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : ''
          })
        } catch {
          continue // 单个草稿损坏不影响其它
        }
      }
      // 最新修改的排前面
      drafts.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      return drafts
    } catch {
      return []
    }
  })

  // 只按 id 清除单份草稿：绝不整目录删除（多标签下可能有数份未保存简历）
  ipcMain.handle('file:autorecover:clear', async (_e, id: unknown) => {
    const safeId = typeof id === 'string' && /^[A-Za-z0-9-]{4,64}$/.test(id) ? id : null
    if (!safeId) return
    await rm(join(autorecoverDir(), `${safeId}.json`), { force: true })
  })

  // 自测专用：按路径打开、但不写入「最近文件」（避免测试污染用户的最近列表）。
  // 只在开发模式注册，打包版不存在这个通道。
  if (!app.isPackaged) {
    ipcMain.handle('file:__testOpenPath', (e, tabId: unknown, path: unknown) => {
      const t = asTabId(tabId)
      if (!t) return { error: '内部错误：标签无效' }
      if (typeof path !== 'string') return { error: '路径无效' }
      return openPath(path, e.sender, t, false)
    })
  }
}
