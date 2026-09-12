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

  // 4. 点击 AI 解析后密集采样（每 300ms 一次）：模型快的时候 2 秒就返回，
  //    每秒采样会整段错过流式窗口，导致「明明成功却报失败」的假故障
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

  let everChipsOn = false
  let everStreamed = false
  let last = null
  let prevKey = ''
  const started = Date.now()
  while (Date.now() - started < 60_000) {
    const s = await snap()
    last = s
    if (s.chipsOn > 0) everChipsOn = true
    if (/已生成/.test(s.desc)) everStreamed = true
    // 只在状态发生变化时打印，避免刷屏
    const key = `${s.importing}|${s.chipsOn}|${/已生成/.test(s.desc)}|${s.dialogGone}|${s.error}`
    if (key !== prevKey) {
      console.log(`[${((Date.now() - started) / 1000).toFixed(1)}s] ${JSON.stringify(s)}`)
      prevKey = key
    }
    if (s.dialogGone || s.error) break
    await sleep(300)
  }

  // 对话框正常关闭 = 导入成功；此时编辑器里应该已经有板块了
  const sectionCards = await evalJs(`document.querySelectorAll('.section-card').length`)
  const tabNames = await evalJs(`window.__mrTestTabs.list().map((t) => t.name)`)

  const passed = everChipsOn && everStreamed && last?.dialogGone && !last?.error && sectionCards > 0
  console.log('=== 结论 ===')
  console.log('清单出现过点亮:', everChipsOn)
  console.log('出现过「已生成 N 字」:', everStreamed)
  console.log('导入后编辑器板块数:', sectionCards, '| 标签:', JSON.stringify(tabNames))
  console.log('最终状态:', JSON.stringify(last))
  console.log(passed ? '全部通过' : '失败')
  if (consoleErrors.length) console.log('控制台异常:\n' + consoleErrors.slice(0, 3).join('\n———\n'))

  // 收尾：关掉本次自测产生的简历标签并清掉草稿，别给下一次运行/用户留下垃圾
  await evalJs(`window.__mrTestTabs.list().filter((t) => t.kind === 'doc').forEach((t) => window.__mrTestTabs.close(t.id))`)
  await sleep(500)
  await evalJs(`(async () => {
    const all = await window.myresume.file.autorecoverRead()
    for (const d of all) await window.myresume.file.autorecoverClear(d.id)
  })()`)
  console.log('收尾后标签:', JSON.stringify(await evalJs(`window.__mrTestTabs.list().map((t) => t.name)`)))
  ws.close()
}

main().catch((e) => {
  console.error('自测脚本异常:', e.message)
  process.exit(1)
})
