/**
 * 稳定唯一 id 生成（浏览器与 Node 均可用的 crypto API）。
 * 文档 / 板块 / 条目三级 id 是未来云端差量同步的锚点。
 */
export function uid(): string {
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  let hex = ''
  for (const b of bytes) hex += b.toString(16).padStart(2, '0')
  return `${Date.now().toString(36)}-${hex}`
}
