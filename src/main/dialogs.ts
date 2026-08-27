import { BrowserWindow, dialog, ipcMain } from 'electron'
import { readFile } from 'node:fs/promises'
import { extname } from 'node:path'

const IMAGE_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp'
}

/**
 * 系统对话框类 IPC。文件路径只出现在主进程，
 * 渲染进程拿到的是文件内容（dataUrl），不是路径——最小权限路径模型。
 */
export function registerDialogIpc(): void {
  ipcMain.handle('dialog:pickPhoto', async () => {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    if (!win) return null

    const result = await dialog.showOpenDialog(win, {
      title: '选择证件照',
      filters: [{ name: '图片', extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp'] }],
      properties: ['openFile']
    })

    const path = result.filePaths[0]
    if (result.canceled || !path) return null

    const mime = IMAGE_MIME[extname(path).toLowerCase()] ?? 'image/jpeg'
    const buf = await readFile(path)
    return { dataUrl: `data:${mime};base64,${buf.toString('base64')}` }
  })
}
