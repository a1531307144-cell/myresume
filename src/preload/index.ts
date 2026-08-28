import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type {
  AiConfigView,
  AiParseResult,
  AiProfilePatch,
  AiProgress,
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
    pickImportFile: (): Promise<PickedImportFile | null> => ipcRenderer.invoke('dialog:pickImportFile'),
    /** 读取拖放进来的简历文件（扩展名白名单 + 大小限制在主进程校验） */
    readDropped: (path: string): Promise<PickedImportFile> => ipcRenderer.invoke('dialog:readDropped', path)
  },
  ai: {
    getConfig: (): Promise<AiConfigView> => ipcRenderer.invoke('ai:getConfig'),
    /** 新增/更新模型档案；apiKey 留空=保留原值，null=清除 */
    saveProfile: (
      patch: AiProfilePatch
    ): Promise<{ ok: boolean; error?: string; id?: string }> => ipcRenderer.invoke('ai:saveProfile', patch),
    deleteProfile: (id: string): Promise<void> => ipcRenderer.invoke('ai:deleteProfile', id),
    setActive: (id: string): Promise<void> => ipcRenderer.invoke('ai:setActive', id),
    /** 测试连接（可传未保存的表单；apiKey 留空用已存 Key） */
    test: (probe: { id?: string; baseUrl?: string; model?: string; apiKey?: string }): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke('ai:test', probe),
    /** 纯文本 → 主进程代理 AI 解析 → 校验后的结构化结果；profileId 缺省用常用档案 */
    parse: (text: string, profileId?: string): Promise<AiParseResult> => ipcRenderer.invoke('ai:parse', { text, profileId }),
    cancel: (): Promise<void> => ipcRenderer.invoke('ai:cancel'),
    /** 流式生成进度（已接收字符数） */
    onProgress: (cb: (progress: AiProgress) => void): void => {
      ipcRenderer.on('ai:progress', (_e, progress: AiProgress) => cb(progress))
    }
  },
  file: {
    /** 多窗口：新建简历 = 开新窗口（当前窗口不受影响） */
    newWindow: (): Promise<void> => ipcRenderer.invoke('file:new-window'),
    /** 拖放文件的系统路径（Electron 官方 webUtils 方式，路径仅用于交回主进程读取） */
    getPathForFile: (file: File): string => webUtils.getPathForFile(file),
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
