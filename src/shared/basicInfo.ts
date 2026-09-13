import type { ContactField, Section } from './schema'

/**
 * 「求职意向」在数据模型里不是独立字段，而是「基本信息」里的一行联系方式（label 为「求职意向」）。
 * 各模板都会把它提到显眼位置。
 *
 * 这套约定**必须只有一个出处**：以前匹配规则在 4 个模板、AI 提示词、导入解析里各写一份，
 * 结果表格模板硬写了「求职意向」标签、而用户根本没有那一行，于是出现「有标签却填不进去」。
 */
export const JOB_TARGET_LABEL = /求职意向|求职方向|意向岗位|目标岗位|应聘岗位|求职目标/

export function findJobTargetContact(contacts: ContactField[] | undefined): ContactField | undefined {
  return (contacts ?? []).find((c) => JOB_TARGET_LABEL.test(c.label ?? ''))
}

/** 读出求职意向的值；没填或没这一行时返回空串 */
export function readJobTarget(sections: Section[] | undefined): string {
  const basic = (sections ?? []).find((s) => s.type === 'basicInfo')
  const contacts = (basic?.data as { contacts?: ContactField[] } | undefined)?.contacts
  return (findJobTargetContact(contacts)?.value ?? '').trim()
}

/** 除求职意向之外、且填了内容的联系方式（模板用它渲染普通联系方式，避免与求职意向重复展示） */
export function otherContacts(contacts: ContactField[] | undefined): ContactField[] {
  return (contacts ?? []).filter((c) => c.value.trim() && !JOB_TARGET_LABEL.test(c.label ?? ''))
}

/** 保证联系方式里有一行「求职意向」可填（导入结果用；已有则原样返回） */
export function ensureJobTargetSlot(
  contacts: ContactField[],
  idFactory: () => string
): ContactField[] {
  if (contacts.some((c) => JOB_TARGET_LABEL.test(c.label ?? ''))) return contacts
  return [{ id: idFactory(), label: '求职意向', value: '' }, ...contacts]
}
