import type { ResumeDocument } from './schema'
import type { ParsedResume } from './importer'

/** 三进程 IPC 契约类型（preload 与渲染进程共用） */

export type MenuAction =
  | 'new-doc'
  | 'open-doc'
  | 'import-doc'
  | 'save-doc'
  | 'save-as-doc'
  | 'save-all-and-close'
  | 'close-tab'
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

/** 应用内防丢草稿（从未保存过的新文档）；按文档 id 一份 */
export interface DraftItem {
  id: string
  doc: ResumeDocument
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

/** 用户自备的 AI 服务配置（OpenAI 兼容格式）；apiKey 只存本机 userData，永不出主进程 */
export interface AiProfile {
  id: string
  name: string
  baseUrl: string
  model: string
  apiKey: string
}

/** 渲染层可见的模型配置（Key 只有掩码） */
export interface AiProfileView {
  id: string
  name: string
  baseUrl: string
  model: string
  hasKey: boolean
  keyMasked: string
}

export interface AiConfigView {
  profiles: AiProfileView[]
  activeId: string
}

/** 保存模型配置的补丁：apiKey 为空=保留原值，null=清除 */
export interface AiProfilePatch {
  id?: string
  name: string
  baseUrl: string
  model: string
  apiKey?: string | null
}

export interface AiParseResult {
  ok: boolean
  error?: string
  parsed?: ParsedResume
  profileName?: string
}

/** AI 任务名：主进程据此选提示词与输入上限 */
export type AiTaskName = 'parse-resume' | 'section-rewrite' | 'section-generate' | 'diagnose'

export interface AiRunRequest {
  /** 由渲染层生成，用于把进度/取消精确对应到某一次请求（多个任务可并行而不串台） */
  taskId: string
  task: AiTaskName
  payload: unknown
  /** 缺省用「常用」档案 */
  profileId?: string
}

export interface AiRunMeta {
  /** 诊断时简历过长被截断 */
  truncated?: boolean
  totalSections?: number
  includedSections?: number
}

export interface AiRunResult {
  ok: boolean
  taskId: string
  error?: string
  /** 模型返回的原始文本（已剥掉代码围栏）；结构校验在渲染层用 shared 的纯函数做 */
  raw?: string
  /** parse-resume 专用：主进程已归一化的结构化结果 */
  parsed?: ParsedResume
  meta?: AiRunMeta
  profileName?: string
}

/** AI 流式生成进度：已接收字符数 + 当前累积内容（用于界面实时展示） */
export interface AiProgress {
  taskId: string
  chars: number
  /** 累积生成的完整文本（节流推送） */
  text: string
}
