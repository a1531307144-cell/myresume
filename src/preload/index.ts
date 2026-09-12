import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type {
  AiConfigView,
  AiProfilePatch,
  AiProgress,
  AiRunRequest,
  AiRunResult,
  DraftItem,
  MenuAction,
  OpenResult,
  PdfResult,
  PickedImportFile,
  PrintPayload,
  RecentItem,
  SaveResult,
  UpdateStatus
} from '../shared/ipc'
import type { UpdateCheckInfo } from '../shared/about'
import type { ResumeDocument } from '../shared/schema'

/**
 * 渲染进程唯一的能力出口（白名单 API）。
 * 原则：渲染进程不接触任何文件路径；一切文件操作经由主进程完成。
 */
const api = {
  app: {
    getVersion: (): Promise<string> => ipcRenderer.invoke('app:getVersion'),
    closeWindow: (): Promise<void> => ipcRenderer.invoke('app:close-window'),
    /** 仅开发模式存在：窗口是否有未保存内容（自测用） */
    __testWindowDirty: (): Promise<boolean> => ipcRenderer.invoke('app:__testWindowDirty')
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
    /** 通用 AI 任务通道：主进程按 task 组装提示词、流式调用并返回模型原文 */
    run: (req: AiRunRequest): Promise<AiRunResult> => ipcRenderer.invoke('ai:run', req),
    /** 取消指定任务（只影响这一个，不影响同时进行的其它 AI 任务） */
    cancel: (taskId: string): Promise<void> => ipcRenderer.invoke('ai:cancel', taskId),
    /**
     * 流式生成进度。返回**取消订阅函数**（务必在组件卸载时调用，
     * 否则每次订阅都会泄漏一个监听器——v0.2.0 的老问题）。
     */
    onProgress: (cb: (progress: AiProgress) => void): (() => void) => {
      const handler = (_e: unknown, progress: AiProgress): void => cb(progress)
      ipcRenderer.on('ai:progress', handler)
      return () => {
        ipcRenderer.removeListener('ai:progress', handler)
      }
    }
  },
  file: {
    /** 拖放文件的系统路径（Electron 官方 webUtils 方式，路径仅用于交回主进程读取） */
    getPathForFile: (file: File): string => webUtils.getPathForFile(file),
    /** 为某个标签重置会话（新建空白简历） */
    newSession: (tabId: string): Promise<void> => ipcRenderer.invoke('file:new', tabId),
    open: (tabId: string): Promise<OpenResult> => ipcRenderer.invoke('file:open', tabId),
    openRecent: (tabId: string, path: string): Promise<OpenResult> =>
      ipcRenderer.invoke('file:openRecent', path, tabId),
    getRecent: (): Promise<RecentItem[]> => ipcRenderer.invoke('file:getRecent'),
    save: (doc: ResumeDocument, tabId: string): Promise<SaveResult> =>
      ipcRenderer.invoke('file:save', doc, tabId),
    saveAs: (doc: ResumeDocument, tabId: string): Promise<SaveResult> =>
      ipcRenderer.invoke('file:saveAs', doc, tabId),
    setDirty: (v: boolean, tabId: string): Promise<void> => ipcRenderer.invoke('file:set-dirty', v, tabId),
    /** 切换标签后刷新窗口标题（首页标签传空串） */
    setActiveTab: (tabId: string): Promise<void> => ipcRenderer.invoke('file:set-active-tab', tabId),
    /** 关闭标签：主进程丢弃该标签的会话 */
    closeTab: (tabId: string): Promise<void> => ipcRenderer.invoke('file:close-tab', tabId),
    /** 仅开发模式存在：按路径打开且不写入「最近文件」（自测用，避免污染用户数据） */
    __testOpenPath: (tabId: string, path: string): Promise<OpenResult> =>
      ipcRenderer.invoke('file:__testOpenPath', tabId, path),
    autorecoverSave: (doc: ResumeDocument): Promise<void> =>
      ipcRenderer.invoke('file:autorecover:save', doc),
    /** 全部未保存草稿（按修改时间倒序），启动时逐份恢复 */
    autorecoverRead: (): Promise<DraftItem[]> => ipcRenderer.invoke('file:autorecover:read'),
    autorecoverClear: (id: string): Promise<void> => ipcRenderer.invoke('file:autorecover:clear', id)
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
    /** 「关于」用：上次自动检查是否失败（失败时提示是网络问题，避免误以为没有新版） */
    getCheckInfo: (): Promise<UpdateCheckInfo> => ipcRenderer.invoke('update:getCheckInfo'),
    /** 仅开发模式存在：置位/复位「自动检查失败」标志（自测用） */
    __testSetCheckFailed: (v: boolean): Promise<void> =>
      ipcRenderer.invoke('update:__testSetCheckFailed', v),
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
