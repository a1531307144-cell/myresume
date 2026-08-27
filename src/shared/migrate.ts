import { SCHEMA_VERSION } from './schema'
import type { ResumeDocument } from './schema'

export type LoadResult = { ok: true; doc: ResumeDocument } | { ok: false; error: string }

/**
 * 打开文档的统一入口：校验文件身份，逐级迁移旧 schemaVersion。
 * 纯函数，vitest 覆盖；未来 v1→v2 等步骤在此追加。
 */
export function loadMigrate(raw: unknown): LoadResult {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, error: '文件内容为空或格式不正确' }
  }
  const obj = raw as Record<string, unknown>
  if (obj['app'] !== 'MyResume') {
    return { ok: false, error: '这不是「我的简历」创建的文档' }
  }
  const version = typeof obj['schemaVersion'] === 'number' ? obj['schemaVersion'] : 0
  if (version > SCHEMA_VERSION) {
    return { ok: false, error: '该文档由更新版本的「我的简历」创建，请先升级软件' }
  }
  // v0 → v1：（v1 为首发格式，实际不存在 v0 文件；此处只做健壮性修补）
  const doc = obj as unknown as ResumeDocument
  if (!Array.isArray(doc.sections)) doc.sections = []
  if (!doc.meta || typeof doc.meta.template !== 'string') doc.meta = { template: 'law-classic' }
  doc.schemaVersion = SCHEMA_VERSION
  return { ok: true, doc }
}
