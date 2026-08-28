import type { ResumeDocument } from './schema'
import type { ParsedResume } from './importer'

/** 三进程 IPC 契约类型（preload 与渲染进程共用） */

export type MenuAction =
  | 'new-doc'
  | 'open-doc'
  | 'import-doc'
  | 'save-doc'
  | 'save-as-doc'
  | 'save-and-close'
  | 'about'
  | 'check-updates'
  | { type: 'open-recent'; path: string }

export type UpdateStatus =
  | { type: 'checking' }
  | { type: 'available'; version: string }
  | { type: 'not-available'; manual: boolean }
  | { type: 'downloading'; percent: number }
  | { type: 'downloaded'; version: string }
  | { type: 'error'; manual: boolean }

export interface OpenResult {
  canceled?: boolean
  error?: string
  path?: string
  name?: string
  doc?: ResumeDocument
}

export interface SaveResult {
  canceled?: boolean
  error?: string
  path?: string
  name?: string
}

export interface RecentItem {
  path: string
  name: string
  updatedAt: string
}

export interface PdfResult {
  canceled?: boolean
  savedPath?: string
  error?: string
}

export interface PrintPayload {
  doc: ResumeDocument
}

/** 导入文件选择结果：路径不出主进程，只回传文件名与内容（base64） */
export interface PickedImportFile {
  name: string
  ext: string
  dataBase64: string
}

/** 用户自备的 AI 服务配置（OpenAI 兼容格式）；apiKey 只存本机 userData */
export interface AiConfig {
  baseUrl: string
  model: string
  apiKey: string
}

export interface AiConfigView {
  baseUrl: string
  model: string
  hasKey: boolean
  keyMasked: string
}

export interface AiParseResult {
  ok: boolean
  error?: string
  parsed?: ParsedResume
}
