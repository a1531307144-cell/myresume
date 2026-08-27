import { contextBridge, ipcRenderer } from 'electron'

/**
 * 渲染进程唯一的能力出口（白名单 API）。
 * 原则：渲染进程不接触任何文件路径；一切文件操作经由主进程完成。
 */
const api = {
  app: {
    getVersion: (): Promise<string> => ipcRenderer.invoke('app:getVersion')
  },
  dialog: {
    /** 返回原图 dataUrl（渲染进程负责压缩），取消返回 null */
    pickPhoto: (): Promise<{ dataUrl: string } | null> => ipcRenderer.invoke('dialog:pickPhoto')
  }
}

export type MyResumeApi = typeof api

contextBridge.exposeInMainWorld('myresume', api)
