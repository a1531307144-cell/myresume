import type { ResumeDocument, Typography } from './schema'

/** 可选字体（全部为 Windows 系统自带，无需打包；字体栈预留 Mac 回退） */
export interface FontOption {
  id: string
  name: string
  stack: string
}

export const FONT_OPTIONS: FontOption[] = [
  { id: 'simsun', name: '宋体（正式稳重）', stack: '"SimSun", "宋体", "Songti SC", serif' },
  { id: 'yahei', name: '微软雅黑（现代清晰）', stack: '"Microsoft YaHei", "PingFang SC", sans-serif' },
  { id: 'kaiti', name: '楷体（人文书卷）', stack: '"KaiTi", "楷体", "Kaiti SC", "STKaiti", serif' },
  { id: 'fangsong', name: '仿宋（公文风）', stack: '"FangSong", "仿宋", "Fangsong SC", "STFangsong", serif' },
  { id: 'simhei', name: '黑体（醒目有力）', stack: '"SimHei", "黑体", "PingFang SC", sans-serif' }
]

export const FONT_BY_ID: Record<string, FontOption> = Object.fromEntries(FONT_OPTIONS.map((f) => [f.id, f]))

export const FONT_SIZE_RANGE = { min: 12, max: 16, step: 1 } as const

export const LINE_HEIGHT_OPTIONS = [
  { value: 1.5, label: '紧凑' },
  { value: 1.75, label: '标准' },
  { value: 2, label: '宽松' }
] as const

/**
 * 解析文档的排版设置为页面级内联样式（undefined = 模板默认，不下发）。
 * 页面根节点应用后，模板内所有字号用 em 相对布局 → 整体等比缩放。
 */
export function typographyStyle(doc: ResumeDocument): Record<string, string> {
  const t: Typography = doc.meta.typography ?? {}
  const style: Record<string, string> = {}
  if (t.fontFamily && FONT_BY_ID[t.fontFamily]) {
    style.fontFamily = FONT_BY_ID[t.fontFamily]!.stack
  }
  if (t.fontSize) {
    style.fontSize = `${t.fontSize}px`
  }
  if (t.lineHeight) {
    style.lineHeight = String(t.lineHeight)
  }
  return style
}
