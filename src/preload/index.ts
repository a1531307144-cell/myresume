import { contextBridge, ipcRenderer } from 'electron'
import type { MenuAction, OpenResult, PdfResult, PrintPayload, SaveResult } from '../shared/ipc'
import type { ResumeDocument } from '../shared/schema'

/**
 * 渲染进程唯一的能力出口（白名单 API）。
 * 原则：渲染进程不接触任何文件路径；一切文件操作经由主进程完成。
 */
const api = {
  app: {
    getVersion: (): Promise<string> => ipcRenderer.invoke('app:getVersion'),
    closeWindow: (): Promise<void> => ipcRenderer.invoke('app:close-window')
  },
  dialog: {
    /** 返回原图 dataUrl（渲染进程负责压缩），取消返回 null */
    pickPhoto: (): Promise<{ dataUrl: string } | null> => ipcRenderer.invoke('dialog:pickPhoto')
  },
  file: {
    newSession: (): Promise<void> => ipcRenderer.invoke('file:new'),
    open: (): Promise<OpenResult> => ipcRenderer.invoke('file:open'),
    openRecent: (path: string): Promise<OpenResult> => ipcRenderer.invoke('file:openRecent', path),
    save: (doc: ResumeDocument): Promise<SaveResult> => ipcRenderer.invoke('file:save', doc),
    saveAs: (doc: ResumeDocument): Promise<SaveResult> => ipcRenderer.invoke('file:saveAs', doc),
    setDirty: (v: boolean): Promise<void> => ipcRenderer.invoke('file:set-dirty', v),
    autorecoverSave: (doc: ResumeDocument): Promise<void> => ipcRenderer.invoke('file:autorecover:save', doc),
    autorecoverRead: (): Promise<{ doc: ResumeDocument; updatedAt: string } | null> =>
      ipcRenderer.invoke('file:autorecover:read'),
    autorecoverClear: (): Promise<void> => ipcRenderer.invoke('file:autorecover:clear')
  },
  pdf: {
    export: (doc: ResumeDocument): Promise<PdfResult> => ipcRenderer.invoke('pdf:export', doc)
  },
  print: {
    /** 打印窗口专用：接收要渲染的文档 */
    onDoc: (cb: (payload: PrintPayload) => void): void => {
      ipcRenderer.on('print:render', (_e, payload: PrintPayload) => cb(payload))
    },
    /** 打印窗口专用：渲染就绪回执（等字体与图片加载完） */
    ready: (): Promise<void> => ipcRenderer.invoke('print:ready')
  },
  menu: {
    /** 原生菜单动作转发 */
    onAction: (cb: (action: MenuAction) => void): void => {
      ipcRenderer.on('menu:action', (_e, action: MenuAction) => cb(action))
    }
  }
}

export type MyResumeApi = typeof api

contextBridge.exposeInMainWorld('myresume', api)
