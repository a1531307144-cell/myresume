import { contextBridge, ipcRenderer } from 'electron'
import type {
  AiConfig,
  AiConfigView,
  AiParseResult,
  MenuAction,
  OpenResult,
  PdfResult,
  PickedImportFile,
  PrintPayload,
  RecentItem,
  SaveResult,
  UpdateStatus
} from '../shared/ipc'
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
    pickPhoto: (): Promise<{ dataUrl: string } | null> => ipcRenderer.invoke('dialog:pickPhoto'),
    /** 选择要导入的简历文件，取消返回 null */
    pickImportFile: (): Promise<PickedImportFile | null> => ipcRenderer.invoke('dialog:pickImportFile')
  },
  ai: {
    getConfig: (): Promise<AiConfigView> => ipcRenderer.invoke('ai:getConfig'),
    setConfig: (patch: { baseUrl?: string; model?: string; apiKey?: string | null }): Promise<void> =>
      ipcRenderer.invoke('ai:setConfig', patch),
    test: (): Promise<{ ok: boolean; error?: string }> => ipcRenderer.invoke('ai:test'),
    /** 纯文本 → 主进程代理 AI 解析 → 校验后的结构化结果 */
    parse: (text: string): Promise<AiParseResult> => ipcRenderer.invoke('ai:parse', { text })
  },
  file: {
    newSession: (): Promise<void> => ipcRenderer.invoke('file:new'),
    open: (): Promise<OpenResult> => ipcRenderer.invoke('file:open'),
    openRecent: (path: string): Promise<OpenResult> => ipcRenderer.invoke('file:openRecent', path),
    getRecent: (): Promise<RecentItem[]> => ipcRenderer.invoke('file:getRecent'),
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
  update: {
    check: (): Promise<void> => ipcRenderer.invoke('update:check'),
    download: (): Promise<void> => ipcRenderer.invoke('update:download'),
    install: (): Promise<void> => ipcRenderer.invoke('update:install'),
    onStatus: (cb: (status: UpdateStatus) => void): void => {
      ipcRenderer.on('update:status', (_e, status: UpdateStatus) => cb(status))
    }
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
