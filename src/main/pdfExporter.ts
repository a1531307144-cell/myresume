import { BrowserWindow, dialog, ipcMain } from 'electron'
import { join } from 'node:path'
import { rename, writeFile } from 'node:fs/promises'
import type { ResumeDocument } from '../shared/schema'
import type { PdfResult } from '../shared/ipc'

/**
 * PDF 导出管线：
 * 隐藏打印窗口（show:false，不用 offscreen——规避 headless 模式 break-inside 失效的已知问题）
 * 加载 print.html，复用与预览完全相同的模板组件；
 * 渲染就绪回执后 printToPDF（margins:0，页边距完全由模板 CSS 的 padding 15mm 控制，
 * 与预览同一坐标系——所见即所得）。
 */

let printWin: BrowserWindow | null = null
let readyResolve: (() => void) | null = null

async function ensurePrintWindow(): Promise<BrowserWindow> {
  if (printWin && !printWin.isDestroyed()) return printWin

  printWin = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    await printWin.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/print.html`)
  } else {
    await printWin.loadFile(join(__dirname, '../renderer/print.html'))
  }
  return printWin
}

function suggestPdfName(doc: ResumeDocument): string {
  const basic = doc.sections.find((s) => s.type === 'basicInfo')
  const data = basic?.data as { name?: string } | undefined
  const name = data?.name?.trim() || '简历'
  return `${name}_简历.pdf`
}

export async function exportPdf(doc: ResumeDocument): Promise<PdfResult> {
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  if (!win) return { canceled: true }

  try {
    const printWindow = await ensurePrintWindow()

    // 等待本轮渲染就绪（打印窗口回执），15 秒超时兜底
    const ready = new Promise<void>((resolve) => {
      readyResolve = resolve
    })
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('打印渲染超时')), 15000)
    })
    printWindow.webContents.send('print:render', { doc })
    await Promise.race([ready, timeout])

    const pdfBuffer = await printWindow.webContents.printToPDF({
      pageSize: 'A4',
      printBackground: true,
      margins: { top: 0, bottom: 0, left: 0, right: 0 }
    })

    const r = await dialog.showSaveDialog(win, {
      title: '导出 PDF',
      defaultPath: suggestPdfName(doc),
      filters: [{ name: 'PDF 文档', extensions: ['pdf'] }]
    })
    if (r.canceled || !r.filePath) return { canceled: true }

    let path = r.filePath
    if (!path.toLowerCase().endsWith('.pdf')) path += '.pdf'

    // 原子写
    const tmp = `${path}.tmp`
    await writeFile(tmp, pdfBuffer)
    await rename(tmp, path)
    return { savedPath: path }
  } catch (err) {
    console.error('PDF 导出失败', err)
    return { error: '导出 PDF 失败，请重试' }
  }
}

/**
 * 退出前销毁隐藏打印窗口。
 * 该窗口常驻复用（避免每次导出都重建），但它会让 window-all-closed 不触发，
 * 若不主动销毁，导出过 PDF 后关闭主窗口会残留一个看不见的进程。
 */
export function destroyPrintWindow(): void {
  if (printWin && !printWin.isDestroyed()) printWin.destroy()
  printWin = null
  readyResolve = null
}

export function registerPdfIpc(): void {
  ipcMain.handle('pdf:export', (_e, doc: ResumeDocument) => exportPdf(doc))
  // 打印窗口渲染就绪回执
  ipcMain.handle('print:ready', () => {
    readyResolve?.()
    readyResolve = null
  })
}
