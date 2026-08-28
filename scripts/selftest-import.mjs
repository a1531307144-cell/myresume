// 导入流程自测：通过 CDP 驱动真实应用，验证 AI 解析的实时反馈是否出现
// 用法: node scripts/selftest-import.mjs  （需先以开发模式启动应用）
const CDP_PORT = 9222

const sampleText = `测试用户
电话：13900001111
邮箱：test@example.com
教育背景
2021.09-2025.06 某某大学 | 法学本科
GPA 3.8/4.0
实习经历
2024.07-2024.09 某某律师事务所 | 实习生
· 协助整理案卷
技能证书
证书：法律职业资格证
自我评价
学习认真。`

const b64 = Buffer.from(sampleText, 'utf-8').toString('base64')

async function main() {
  const list = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json`)).json()
  const page = list.find((t) => t.type === 'page' && /^http:\/\/localhost:5173\/?$/.test(t.url))
  if (!page) {
    console.log('FAIL: 找不到应用主窗口页面。窗口列表:', list.map((t) => ({ type: t.type, url: t.url })))
    process.exit(1)
  }

  const ws = new WebSocket(page.webSocketDebuggerUrl)
  let seq = 0
  const pending = new Map()
  const consoleErrors = []
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data)
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m.result)
      pending.delete(m.id)
      return
    }
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params?.exceptionDetails ?? {}
      consoleErrors.push(d.exception?.description ?? d.text ?? 'unknown exception')
    }
    if (m.method === 'Runtime.consoleAPICalled' && m.params?.type === 'error') {
      consoleErrors.push(JSON.stringify(m.params.args?.map((a) => a.value ?? a.description ?? '') ?? []))
    }
  }
  await new Promise((resolve) => (ws.onopen = resolve))
  await send('Runtime.enable', {})

  const evalJs = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    return r?.result?.value
  }
  function send(method, params) {
    return new Promise((resolve) => {
      const id = ++seq
      pending.set(id, resolve)
      ws.send(JSON.stringify({ id, method, params }))
    })
  }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

  // 0. 确认应用就绪
  let ready = await evalJs(`!!document.querySelector('#app')`)
  console.log('应用页面就绪:', ready)

  // 1. 打开导入对话框
  await evalJs(`window.__mrTest.openImport()`)
  await sleep(400)
  console.log('导入对话框出现:', await evalJs(`!!document.querySelector('.import-card')`))

  // 2. 注入测试文件 → 应进入「ready」步骤
  await evalJs(`window.__mrTestImport({ name: '自测简历.txt', ext: 'txt', dataBase64: ${JSON.stringify(b64)} })`)
  let ok = false
  for (let i = 0; i < 20; i++) {
    await sleep(300)
    if (await evalJs(`!!document.querySelector('.ai-run')`)) {
      ok = true
      break
    }
  }
  console.log('文件提取完成(出现解析选项):', ok)
  if (!ok) {
    console.log('错误信息:', await evalJs(`document.querySelector('.error')?.textContent ?? '(无)'`))
    process.exit(1)
  }

  // 3. 等待模型配置检查完成（aiReady 不再是 null）
  let state = null
  for (let i = 0; i < 20; i++) {
    state = await evalJs(`window.__mrTestState ? window.__mrTestState() : null`)
    if (state && state.aiReady !== null) break
    await sleep(300)
  }
  console.log('模型配置状态:', JSON.stringify(state))

  // 4. 点击 AI 解析，每秒记录画面状态（清单点亮数/字数/错误），共 40 秒
  const clicked = await evalJs(`(() => { const el = document.querySelector('.ai-run'); if (!el) return 'NO_ELEMENT'; el.click(); return 'CLICKED' })()`)
  console.log('点击 AI 解析:', clicked)
  const snap = () =>
    evalJs(`(() => {
      const chips = [...document.querySelectorAll('.check-chip')]
      return {
        importing: !!document.querySelector('.cancel-parse') || !!document.querySelector('.stream-bar'),
        chipsTotal: chips.length,
        chipsOn: chips.filter((c) => c.classList.contains('on')).length,
        desc: document.querySelector('.import-card .desc')?.textContent?.trim().slice(0, 80) ?? '',
        error: document.querySelector('.error')?.textContent?.trim() ?? '',
        dialogGone: !document.querySelector('.import-card')
      }
    })()`)
  const timeline = []
  for (let i = 0; i < 40; i++) {
    const s = await snap()
    timeline.push({ t: i + 1, ...s })
    if (s.dialogGone || s.error) break
    await sleep(1000)
  }
  for (const t of timeline) console.log(JSON.stringify(t))

  const last = timeline[timeline.length - 1]
  const everChipsOn = timeline.some((t) => t.chipsOn > 0)
  const everStreamed = timeline.some((t) => /已生成/.test(t.desc))
  console.log('=== 结论 ===')
  console.log('清单出现过点亮:', everChipsOn)
  console.log('出现过「已生成 N 字」:', everStreamed)
  console.log('最终状态:', JSON.stringify(last))
  if (consoleErrors.length) console.log('控制台异常:\n' + consoleErrors.slice(0, 3).join('\n———\n'))
  ws.close()
}

main().catch((e) => {
  console.error('自测脚本异常:', e.message)
  process.exit(1)
})
