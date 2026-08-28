import { BrowserWindow, dialog, ipcMain } from 'electron'
import { readFile } from 'node:fs/promises'
import { basename, extname } from 'node:path'

const IMAGE_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp'
}

/** 导入简历文件大小上限（防解压炸弹/内存耗尽） */
const MAX_IMPORT_BYTES = 20 * 1024 * 1024

/** 拖放导入允许的扩展名白名单 */
const IMPORT_EXTS = ['docx', 'pdf', 'txt']

async function readImportFile(path: string): Promise<{ name: string; ext: string; dataBase64: string }> {
  const ext = extname(path).toLowerCase().replace('.', '')
  if (!IMPORT_EXTS.includes(ext)) {
    throw new Error('仅支持 Word（.docx）、PDF、TXT 文件')
  }
  const buf = await readFile(path)
  if (buf.length > MAX_IMPORT_BYTES) {
    throw new Error('文件超过 20MB 上限')
  }
  return { name: basename(path), ext, dataBase64: buf.toString('base64') }
}

/**
 * 系统对话框类 IPC。文件路径只出现在主进程，
 * 渲染进程拿到的是文件内容（dataUrl/base64），不是路径——最小权限路径模型。
 * （拖放文件例外：路径由系统的拖放事件给出，主进程按白名单扩展名+大小校验后读取）
 */
export function registerDialogIpc(): void {
  ipcMain.handle('dialog:readDropped', async (_e, path: unknown) => {
    if (typeof path !== 'string' || !path.trim()) {
      throw new Error('无效的文件')
    }
    return readImportFile(path)
  })

  ipcMain.handle('dialog:pickImportFile', async () => {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    if (!win) return null

    const result = await dialog.showOpenDialog(win, {
      title: '选择要导入的简历',
      filters: [{ name: '简历文件', extensions: ['docx', 'pdf', 'txt'] }],
      properties: ['openFile']
    })

    const path = result.filePaths[0]
    if (result.canceled || !path) return null

    return readImportFile(path)
  })

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
