import type { ResumeDocument } from './schema'

/** 三进程 IPC 契约类型（preload 与渲染进程共用） */

export type MenuAction =
  | 'new-doc'
  | 'open-doc'
  | 'save-doc'
  | 'save-as-doc'
  | 'save-and-close'
  | 'about'
  | { type: 'open-recent'; path: string }

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
