import type { ResumeDocument } from './schema'

/** 三进程 IPC 契约类型（preload 与渲染进程共用） */

export type MenuAction =
  | 'new-doc'
  | 'open-doc'
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
