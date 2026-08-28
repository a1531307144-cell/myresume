import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { join } from 'path'
import { registerDialogIpc } from './dialogs'
import { buildAppMenu, watchMenuRebuild } from './menu'
import { destroySession, initFileService, isWindowDirty, registerFileIpc } from './fileService'
import { registerPdfIpc } from './pdfExporter'
import { setupUpdater } from './updater'
import { registerSettingsIpc } from './settings'
import { registerAiIpc } from './aiService'

/** newDoc=true 时直接进入空白编辑器（跳过首页），用于「新建简历」新窗口 */
function createWindow(options?: { newDoc?: boolean }): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    show: false,
    title: '我的简历',
    backgroundColor: '#f7f7fb',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  win.on('ready-to-show', () => {
    if (options?.newDoc) win.setTitle('未命名简历 — 我的简历')
    win.show()
  })

  // 关闭保护：本窗口有未保存修改时拦截关闭，先询问
  win.on('close', (e) => {
    if (!isWindowDirty(win)) return
    e.preventDefault()
    void handleCloseWithDirty(win)
  })

  // 窗口关闭后清理其会话（文件路径/脏标记）
  win.webContents.on('destroyed', () => {
    destroySession(win.webContents.id)
  })

  // 外部链接一律交给系统默认浏览器，不在应用内开新窗口
  win.webContents.setWindowOpenHandler((details) => {
    if (details.url.startsWith('https://')) shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    const url = options?.newDoc ? `${process.env['ELECTRON_RENDERER_URL']}/?new=1` : process.env['ELECTRON_RENDERER_URL']
    void win.loadURL(url)
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'), options?.newDoc ? { query: { new: '1' } } : undefined)
  }
}

async function handleCloseWithDirty(win: BrowserWindow): Promise<void> {
  const r = await dialog.showMessageBox(win, {
    type: 'warning',
    title: '未保存的修改',
    message: '当前简历有未保存的修改',
    detail: '关闭前是否保存？',
    buttons: ['保存并关闭', '直接关闭', '取消'],
    defaultId: 0,
    cancelId: 2,
    noLink: true
  })
  if (r.response === 2) return // 取消
  if (r.response === 1) {
    win.destroy() // 直接关闭（自动保存草稿可能已存在，不影响）
    return
  }
  // 保存并关闭：由渲染进程执行保存，成功后它会调用 app:close-window
  win.webContents.send('menu:action', 'save-and-close')
}

// 预加载 API 白名单（只读接口）
ipcMain.handle('app:getVersion', () => app.getVersion())

// 渲染进程保存完成后请求关闭（绕过 close 拦截；只关发起请求的窗口）
ipcMain.handle('app:close-window', (e) => {
  BrowserWindow.fromWebContents(e.sender)?.destroy()
})

// 多窗口：「新建简历」开新窗口，当前窗口不受影响
ipcMain.handle('file:new-window', () => {
  createWindow({ newDoc: true })
})

app.whenReady().then(() => {
  registerDialogIpc()
  registerFileIpc()
  registerPdfIpc()
  registerSettingsIpc()
  registerAiIpc()
  void initFileService().then(() => {
    buildAppMenu()
    watchMenuRebuild()
  })
  createWindow()
  setupUpdater()

  app.on('activate', () => {
    // macOS 点击 Dock 图标时若无窗口则重建
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
