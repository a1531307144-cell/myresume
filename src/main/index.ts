import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { join } from 'path'
import { registerDialogIpc } from './dialogs'
import { buildAppMenu, watchMenuRebuild } from './menu'
import { destroySession, initFileService, isWindowDirty, registerFileIpc } from './fileService'
import { registerPdfIpc, destroyPrintWindow } from './pdfExporter'
import { setupUpdater } from './updater'
import { registerSettingsIpc } from './settings'
import { registerAiIpc, destroyAiForSender } from './aiService'

/** 唯一的主窗口（单窗口 + 标签页：多份简历在窗口内以标签承载） */
function createWindow(): void {
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
    win.show()
  })

  // 关闭保护：本窗口**任一标签**有未保存修改时拦截关闭，先询问
  win.on('close', (e) => {
    if (!isWindowDirty(win)) return
    e.preventDefault()
    void handleCloseWithDirty(win)
  })

  // 窗口关闭后清理其名下所有标签的会话（文件路径/脏标记）与还在跑的 AI 任务
  win.webContents.on('destroyed', () => {
    destroySession(win.webContents.id)
    destroyAiForSender(win.webContents.id)
  })

  // 主窗口关掉时顺手销毁常驻的隐藏打印窗口。
  // 否则它会一直活着 → window-all-closed 永不触发 → 关闭窗口后进程残留（v0.2.0 的既有问题）
  win.on('closed', () => {
    destroyPrintWindow()
  })

  // 整页重载（开发期 HMR 全量刷新）会让渲染进程的标签全部重建，
  // 此时必须清掉主进程里的旧会话，否则关闭窗口时会询问一堆并不存在的「未保存简历」
  win.webContents.on('did-start-loading', () => {
    destroySession(win.webContents.id)
  })

  // 外部链接一律交给系统默认浏览器，不在应用内开新窗口
  win.webContents.setWindowOpenHandler((details) => {
    if (details.url.startsWith('https://')) shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

async function handleCloseWithDirty(win: BrowserWindow): Promise<void> {
  const r = await dialog.showMessageBox(win, {
    type: 'warning',
    title: '未保存的修改',
    message: '有简历还没保存',
    detail: '关闭前是否保存全部未保存的简历？',
    buttons: ['全部保存并关闭', '直接关闭', '取消'],
    defaultId: 0,
    cancelId: 2,
    noLink: true
  })
  if (r.response === 2) return // 取消
  if (r.response === 1) {
    win.destroy() // 直接关闭（自动保存草稿可能已存在，不影响）
    return
  }
  // 全部保存并关闭：由渲染进程依次保存各标签，成功后它会调用 app:close-window
  win.webContents.send('menu:action', 'save-all-and-close')
}

// 预加载 API 白名单（只读接口）
ipcMain.handle('app:getVersion', () => app.getVersion())

// 渲染进程保存完成后请求关闭（绕过 close 拦截；只关发起请求的窗口）
ipcMain.handle('app:close-window', (e) => {
  BrowserWindow.fromWebContents(e.sender)?.destroy()
})

// 自测专用：窗口「是否存在未保存内容」（关闭守卫的依据）。
// 只在开发模式注册，打包版不存在这个通道。
if (!app.isPackaged) {
  ipcMain.handle('app:__testWindowDirty', (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    return win ? isWindowDirty(win) : false
  })
}

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

// 隐藏打印窗口常驻复用，退出前必须销毁，否则进程无法自然结束
app.on('before-quit', () => {
  destroyPrintWindow()
})

// 开发模式开放调试端口（自测/排查用；必须在 app ready 前注册；打包版不开启）
if (!app.isPackaged) {
  app.commandLine.appendSwitch('remote-debugging-port', '9222')
}
