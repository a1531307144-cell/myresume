import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { copyFile, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { basename, join } from 'node:path'
import { loadMigrate } from '../shared/migrate'
import type { ResumeDocument } from '../shared/schema'
import type { OpenResult, RecentItem, SaveResult } from '../shared/ipc'

/**
 * 文件服务：当前文件路径只存在主进程（最小权限路径模型）。
 * 原子写（.tmp → rename）杜绝半写损坏；覆盖前自动备份（每文档保留 5 份）。
 */

const session = {
  filePath: null as string | null,
  dirty: false
}

let recentCache: RecentItem[] = []
let recentChangedCb: (() => void) | null = null

const FILE_FILTER = { name: '我的简历文档', extensions: ['myresume', 'json'] }

function userDataDir(): string {
  return app.getPath('userData')
}

function backupsDir(): string {
  return join(userDataDir(), 'backups')
}

function autorecoverFile(): string {
  return join(userDataDir(), 'autorecover.json')
}

function recentFile(): string {
  return join(userDataDir(), 'recent.json')
}

function focusedWin(): BrowserWindow | undefined {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
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

async function openPath(path: string): Promise<OpenResult> {
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
    session.filePath = path
    session.dirty = false
    await pushRecent(path, r.doc.updatedAt)
    return { path, name: basename(path), doc: r.doc }
  } catch {
    return { error: '无法读取文件（可能已被移动或删除）' }
  }
}

async function writeTo(path: string, doc: ResumeDocument): Promise<SaveResult> {
  try {
    await backupExisting(path, doc.id)
    await atomicWrite(path, JSON.stringify(doc, null, 2))
    session.filePath = path
    session.dirty = false
    await pushRecent(path, doc.updatedAt)
    await rm(autorecoverFile(), { force: true }) // 已有正式文件，清掉防丢草稿
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

export function isSessionDirty(): boolean {
  return session.dirty
}

export function registerFileIpc(): void {
  ipcMain.handle('file:new', async () => {
    session.filePath = null
    session.dirty = false
    await rm(autorecoverFile(), { force: true })
  })

  ipcMain.handle('file:open', async () => {
    const win = focusedWin()
    if (!win) return { canceled: true }
    const r = await dialog.showOpenDialog(win, {
      title: '打开简历',
      filters: [FILE_FILTER],
      properties: ['openFile']
    })
    if (r.canceled || !r.filePaths[0]) return { canceled: true }
    return openPath(r.filePaths[0])
  })

  ipcMain.handle('file:openRecent', (_e, path: unknown) => {
    if (typeof path !== 'string') return { error: '路径无效' }
    return openPath(path)
  })

  ipcMain.handle('file:save', (_e, doc: ResumeDocument) => {
    // 渲染进程保证有路径时才调 save；无路径兜底返回错误
    if (!session.filePath) {
      return Promise.resolve({ error: '尚未指定保存位置，请先「另存为」' })
    }
    return writeTo(session.filePath, doc)
  })

  ipcMain.handle('file:saveAs', async (_e, doc: ResumeDocument) => {
    const win = focusedWin()
    if (!win) return { canceled: true }
    const r = await dialog.showSaveDialog(win, {
      title: '保存简历',
      defaultPath: suggestFileName(doc),
      filters: [FILE_FILTER]
    })
    if (r.canceled || !r.filePath) return { canceled: true }
    let path = r.filePath
    if (!/\.(myresume|json)$/i.test(path)) path += '.myresume'
    return writeTo(path, doc)
  })

  ipcMain.handle('file:set-dirty', (_e, v: unknown) => {
    session.dirty = Boolean(v)
  })

  // ———— 防丢草稿（仅用于从未保存过的新文档） ————
  ipcMain.handle('file:autorecover:save', (_e, doc: ResumeDocument) => {
    return atomicWrite(autorecoverFile(), JSON.stringify(doc)).catch((err) => {
      console.warn('草稿保存失败', err)
    })
  })

  ipcMain.handle('file:autorecover:read', async () => {
    try {
      const text = await readFile(autorecoverFile(), 'utf-8')
      const doc = JSON.parse(text)
      if (doc?.app === 'MyResume') return { doc, updatedAt: doc.updatedAt as string }
      return null
    } catch {
      return null
    }
  })

  ipcMain.handle('file:autorecover:clear', () => rm(autorecoverFile(), { force: true }))
}
