import { app, BrowserWindow, ipcMain } from 'electron'
import { autoUpdater } from 'electron-updater'
import type { UpdateStatus } from '../shared/ipc'

/**
 * 自动更新：启动 3 秒后静默检查；发现新版本只提示，由用户决定是否下载安装。
 * 原则：更新永远不干扰编辑、不擅自下载——任何网络错误只写日志，零弹窗。
 * 仅打包版启用（开发版检查更新无意义且会报错）。
 */

let manualCheck = false

function broadcast(payload: UpdateStatus): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('update:status', payload)
  }
}

export function setupUpdater(): void {
  if (!app.isPackaged) return

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.logger = console

  autoUpdater.on('checking-for-update', () => broadcast({ type: 'checking' }))
  autoUpdater.on('update-available', (info) => broadcast({ type: 'available', version: info.version }))
  autoUpdater.on('download-progress', (p) => broadcast({ type: 'downloading', percent: Math.round(p.percent) }))
  autoUpdater.on('update-downloaded', (info) => {
    manualCheck = false
    broadcast({ type: 'downloaded', version: info.version })
  })
  autoUpdater.on('update-not-available', () => {
    const manual = manualCheck
    manualCheck = false
    broadcast({ type: 'not-available', manual })
  })
  autoUpdater.on('error', (err) => {
    const manual = manualCheck
    manualCheck = false
    console.warn('更新失败（不影响使用）', err)
    broadcast({ type: 'error', manual })
  })

  // 手动「检查更新」入口（帮助菜单）
  ipcMain.handle('update:check', () => {
    manualCheck = true
    autoUpdater.checkForUpdates().catch((err) => {
      console.warn('手动检查更新失败', err)
    })
  })

  // 用户在提示框点「下载安装」后才开始下载
  ipcMain.handle('update:download', () => {
    autoUpdater.downloadUpdate().catch((err) => {
      console.warn('下载更新失败', err)
    })
  })

  // 静默安装并重启（per-user 安装无需管理员权限）
  ipcMain.handle('update:install', () => {
    autoUpdater.quitAndInstall(true, true)
  })

  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {
      /* 自动检查失败完全静默 */
    })
  }, 3000)
}
