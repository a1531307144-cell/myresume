import { BrowserWindow, Menu } from 'electron'
import type { MenuItemConstructorOptions } from 'electron'
import type { MenuAction } from '../shared/ipc'
import { getRecentList, onRecentChanged } from './fileService'

function sendAction(action: MenuAction): void {
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  win?.webContents.send('menu:action', action)
}

/** 原生应用菜单（中文）。文件类操作统一转发给渲染进程协调（文档数据在渲染层）。 */
export async function buildAppMenu(): Promise<void> {
  const recent = getRecentList()

  const recentSub: MenuItemConstructorOptions[] = recent.length
    ? recent.map((item) => ({
        label: item.name,
        click: () => sendAction({ type: 'open-recent', path: item.path })
      }))
    : [{ label: '（暂无）', enabled: false }]

  const template: MenuItemConstructorOptions[] = [
    {
      label: '文件',
      submenu: [
        { label: '新建简历', accelerator: 'CmdOrCtrl+N', click: () => sendAction('new-doc') },
        { label: '打开…', accelerator: 'CmdOrCtrl+O', click: () => sendAction('open-doc') },
        { label: '最近文件', submenu: recentSub },
        { type: 'separator' },
        { label: '保存', accelerator: 'CmdOrCtrl+S', click: () => sendAction('save-doc') },
        { label: '另存为…', accelerator: 'CmdOrCtrl+Shift+S', click: () => sendAction('save-as-doc') },
        { type: 'separator' },
        { role: 'quit', label: '退出' }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' }
      ]
    },
    {
      label: '视图',
      submenu: [
        { role: 'resetZoom', label: '实际大小' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏' },
        { role: 'toggleDevTools', label: '开发者工具' }
      ]
    },
    {
      label: '帮助',
      submenu: [{ label: '关于「我的简历」', click: () => sendAction('about') }]
    }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

/** 最近文件变化时重建菜单（保持「最近文件」子菜单同步） */
export function watchMenuRebuild(): void {
  onRecentChanged(() => {
    void buildAppMenu()
  })
}
