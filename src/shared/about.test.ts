import { describe, expect, it } from 'vitest'
import { buildAboutText } from './about'

describe('buildAboutText', () => {
  it('至少包含版本号与仓库地址', () => {
    const t = buildAboutText('0.3.1')
    expect(t).toContain('v0.3.1')
    expect(t).toContain('https://github.com/a1531307144-cell/myresume')
  })

  it('检查更新正常时，不出现失败提示', () => {
    const t = buildAboutText('0.3.1', { lastAutoCheckFailed: false })
    expect(t).not.toContain('没成功')
  })

  it('信息缺省时也不出现失败提示', () => {
    expect(buildAboutText('0.3.1', null)).not.toContain('没成功')
    expect(buildAboutText('0.3.1')).not.toContain('没成功')
  })

  it('上次自动检查失败时，给出「是网络问题」而非「已是最新」的提示', () => {
    const t = buildAboutText('0.3.1', { lastAutoCheckFailed: true })
    expect(t).toContain('上次自动检查更新没成功')
    expect(t).toContain('帮助 → 检查更新')
    // 关键：不能让人误以为「已经检查过、没有新版」
    expect(t).not.toContain('已是最新')
  })
})
