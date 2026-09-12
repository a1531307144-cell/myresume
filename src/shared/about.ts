/**
 * 「关于」对话框的文案。放在 shared 里是为了能被 vitest 覆盖
 * —— 组装文案属于纯逻辑，不该埋在组件里。
 */

export interface UpdateCheckInfo {
  /** 上次**自动**检查更新是否失败（多半是网络到不了 GitHub） */
  lastAutoCheckFailed: boolean
}

const REPO_URL = 'https://github.com/a1531307144-cell/myresume'

export function buildAboutText(version: string, info?: UpdateCheckInfo | null): string {
  const lines = [
    `我的简历 v${version}`,
    '简单好用的桌面简历编辑器',
    '',
    'MIT 开源',
    REPO_URL
  ]
  if (info?.lastAutoCheckFailed) {
    // 只在这里留一行小字：不弹窗打扰，但你打开「关于」能知道是「网络没通」而不是「没有新版」
    lines.push('', '上次自动检查更新没成功（多半是网络连不上 GitHub）')
    lines.push('可点菜单「帮助 → 检查更新」重试')
  }
  return lines.join('\n')
}
