import { SCHEMA_VERSION } from './schema'
import type { ResumeDocument, TemplateId } from './schema'
import { createSection } from './sectionDefs'
import { uid } from './id'

/**
 * 空文档工厂：只预置「基本信息 + 教育背景」两个空板块。
 * 槽位 label 是字段名不是简历内容，所有 value 为空——零预填内容。
 */
export function createDefaultDocument(template: TemplateId = 'law-classic'): ResumeDocument {
  const now = new Date().toISOString()
  return {
    app: 'MyResume',
    schemaVersion: SCHEMA_VERSION,
    id: uid(),
    createdAt: now,
    updatedAt: now,
    meta: { template },
    sections: [createSection('basicInfo'), createSection('education')]
  }
}
