import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { copyFile, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { basename, join } from 'node:path'
import { loadMigrate } from '../shared/migrate'
import type { ResumeDocument } from '../shared/schema'
import type { OpenResult, RecentItem, SaveResult } from '../shared/ipc'

/**
 * 文件服务（多窗口）：每个窗口一份独立会话（当前文件路径 + 脏标记），
 * 路径只存在主进程（最小权限路径模型）。
 * 原子写（.tmp → rename）杜绝半写损坏；覆盖前自动备份（每文档保留 5 份）；
 * 防丢草稿按文档 id 一份（autorecover/<docId>.json），多窗口互不覆盖。
 */

interface WindowSession {
  filePath: string | null
  dirty: boolean
}

const sessions = new Map<number, WindowSession>()

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

function sessionFor(sender: Electron.WebContents): WindowSession {
  let s = sessions.get(sender.id)
  if (!s) {
    s = { filePath: null, dirty: false }
    sessions.set(sender.id, s)
  }
  return s
}

export function destroySession(webContentsId: number): void {
  sessions.delete(webContentsId)
}

export function isWindowDirty(win: BrowserWindow): boolean {
  return sessions.get(win.webContents.id)?.dirty ?? false
}

function focusedWin(): BrowserWindow | undefined {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
}

function setTitle(sender: Electron.WebContents, name: string): void {
  BrowserWindow.fromWebContents(sender)?.setTitle(`${name} — 我的简历`)
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

async function openPath(path: string, sender: Electron.WebContents): Promise<OpenResult> {
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
    sessionFor(sender).filePath = path
    sessionFor(sender).dirty = false
    await pushRecent(path, r.doc.updatedAt)
    setTitle(sender, basename(path))
    return { path, name: basename(path), doc: r.doc }
  } catch {
    return { error: '无法读取文件（可能已被移动或删除）' }
  }
}

async function writeTo(path: string, doc: ResumeDocument, sender: Electron.WebContents): Promise<SaveResult> {
  try {
    await backupExisting(path, doc.id)
    await atomicWrite(path, JSON.stringify(doc, null, 2))
    sessionFor(sender).filePath = path
    sessionFor(sender).dirty = false
    await pushRecent(path, doc.updatedAt)
    await rm(join(autorecoverDir(), `${doc.id}.json`), { force: true }) // 已落盘，草稿可清
    await rm(join(userDataDir(), 'autorecover.json'), { force: true }) // 旧版单草稿文件清理
    setTitle(sender, basename(path))
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

export function registerFileIpc(): void {
  ipcMain.handle('file:new', (_e) => {
    const s = sessionFor(_e.sender)
    s.filePath = null
    s.dirty = false
    setTitle(_e.sender, '未命名简历')
  })

  ipcMain.handle('file:open', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender) ?? focusedWin()
    if (!win) return { canceled: true }
    const r = await dialog.showOpenDialog(win, {
      title: '打开简历',
      filters: [FILE_FILTER],
      properties: ['openFile']
    })
    if (r.canceled || !r.filePaths[0]) return { canceled: true }
    return openPath(r.filePaths[0], e.sender)
  })

  ipcMain.handle('file:openRecent', (e, path: unknown) => {
    if (typeof path !== 'string') return { error: '路径无效' }
    return openPath(path, e.sender)
  })

  ipcMain.handle('file:getRecent', () => recentCache)

  ipcMain.handle('file:save', (e, doc: ResumeDocument) => {
    const session = sessionFor(e.sender)
    if (!session.filePath) {
      return Promise.resolve({ error: '尚未指定保存位置，请先「另存为」' })
    }
    return writeTo(session.filePath, doc, e.sender)
  })

  ipcMain.handle('file:saveAs', async (e, doc: ResumeDocument) => {
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
    return writeTo(path, doc, e.sender)
  })

  ipcMain.handle('file:set-dirty', (e, v: unknown) => {
    sessionFor(e.sender).dirty = Boolean(v)
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
      let newest: { id: string; doc: ResumeDocument; updatedAt: string } | null = null
      for (const f of files) {
        try {
          const parsed = JSON.parse(await readFile(join(dir, f), 'utf-8'))
          if (parsed?.app !== 'MyResume') continue
          const updatedAt = typeof parsed.updatedAt === 'string' ? parsed.updatedAt : ''
          if (!newest || updatedAt > newest.updatedAt) {
            newest = { id: String(parsed.id ?? f.replace(/\.json$/, '')), doc: parsed, updatedAt }
          }
        } catch {
          continue // 单个草稿损坏不影响其它
        }
      }
      return newest
    } catch {
      return null
    }
  })

  ipcMain.handle('file:autorecover:clear', async (_e, id: unknown) => {
    const safeId = typeof id === 'string' && /^[A-Za-z0-9-]{4,64}$/.test(id) ? id : null
    if (safeId) {
      await rm(join(autorecoverDir(), `${safeId}.json`), { force: true })
    } else {
      // 无 id（旧版调用）：清空整个草稿目录
      await rm(autorecoverDir(), { force: true, recursive: true })
    }
  })
}
