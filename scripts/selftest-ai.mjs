// AI 助手自测：通过 CDP 驱动真实应用，走完「流式 → 校验 → 预览 → 采纳」全链路。
// 用注入的假执行器代替真实网络请求，因此**不需要配置 API Key**，但校验、写回、
// 失败处理这些真实代码路径全部会跑到。
//
// 用法: node scripts/selftest-ai.mjs
// 前提: 先以开发模式启动应用（npm run dev）。
// 注意: 脚本会新建/关闭简历标签来归一化起始状态，请在确认没有正在编辑的简历时运行。

const CDP_PORT = 9222

const GENERATED = [
  '@@1',
  '单位：某某律师事务所',
  '时间：2025.01-2025.03',
  '职务：实习生',
  '- 协助整理民事案件卷宗 XXX 份',
  '- 参与类案检索并输出检索报告 XXX 份'
].join('\n')

const REWRITTEN = ['@@1', '- 整理民事案件卷宗 XXX 份', '- 独立完成证据目录编排与归档'].join('\n')

const DIAGNOSIS = JSON.stringify({
  summary: '整体可用，但成果量化不足',
  issues: [
    { sectionId: '不存在的板块id', itemIndex: 1, severity: 'high', problem: '幻觉问题', suggestion: '不该出现' },
    { sectionId: '<SECTION_ID>', itemIndex: 1, severity: 'high', problem: '经历只写职责不写成果', suggestion: '补上量化的卷宗份数与检索报告数' }
  ]
})

/** 应用可能正因热更新重载，CDP 端口会短暂不可用——重试几次，避免报成假故障 */
async function findPage(retries = 10) {
  let last = []
  for (let i = 0; i < retries; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json`)).json()
      last = list
      const page = list.find((t) => t.type === 'page' && /^http:\/\/localhost:5173\/?$/.test(t.url))
      if (page) return { page, list }
    } catch {
      /* 应用正在重载，稍后重试 */
    }
    if (i < retries - 1) await new Promise((r) => setTimeout(r, 1000))
  }
  return { page: null, list: last }
}

async function main() {
  const { page, list } = await findPage()
  if (!page) {
    console.log('FAIL: 找不到应用主窗口页面（请确认已 npm run dev）。窗口列表:', list.map((t) => ({ type: t.type, url: t.url })))
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

  let failures = 0
  const check = (label, ok, extra = '') => {
    console.log(`${ok ? '  OK  ' : ' FAIL '} ${label}${extra ? '  → ' + extra : ''}`)
    if (!ok) failures += 1
  }

  const tabs = () => evalJs(`window.__mrTestTabs.list()`)
  const aiState = () => evalJs(`window.__mrTestAi.state()`)
  const dgState = () => evalJs(`window.__mrTestAi.diagnoseState()`)

  /** 某个板块当前在界面上呈现的样子（用来断言「采纳前文档一字未改」） */
  const sectionSnapshot = (sid) =>
    evalJs(`(() => {
      const card = document.querySelector('.section-card[data-section-id=' + JSON.stringify(${JSON.stringify(sid)}) + ']')
      if (!card) return null
      return {
        items: card.querySelectorAll('.ed-item-card').length,
        values: [...card.querySelectorAll('.ed-inp, .ed-textarea')].map((el) => el.value)
      }
    })()`)

  // ———————— 0. 应用就绪 ————————
  // 先整页重载，冲刷掉可能正在进行的 HMR 热更新（否则会在中途重置状态造成假故障）
  await evalJs(`location.reload()`)
  await sleep(3200)
  check('应用已挂载', await evalJs(`!!document.querySelector('.app-topbar')`))
  check('AI 自测钩子可用', Boolean(await evalJs(`typeof window.__mrTestAi === 'object'`)))

  // 归一化：关掉遗留的简历标签
  for (const t of await tabs()) {
    if (t.kind === 'doc') await evalJs(`window.__mrTestTabs.close(${JSON.stringify(t.id)})`)
  }
  await sleep(300)

  // ———————— 1. 准备一个「实习经历」板块（初始为空 → 从零写模式） ————————
  await evalJs(`window.__mrTestTabs.newDoc()`)
  await sleep(400)
  await evalJs(`document.querySelector('.picker-btn')?.click()`)
  await sleep(200)
  const picked = await evalJs(`(() => {
    const it = [...document.querySelectorAll('.picker-item')].find(
      (b) => b.querySelector('.picker-name')?.textContent.trim() === '实习经历'
    )
    it?.click()
    return !!it
  })()`)
  check('能添加「实习经历」板块', picked === true)
  await sleep(400)

  const sid = await evalJs(
    `[...document.querySelectorAll('.section-card')].map((c) => c.dataset.sectionId).filter(Boolean).pop()`
  )
  check('能定位到该板块', typeof sid === 'string' && sid.length > 0, String(sid))

  const before = await sectionSnapshot(sid)
  check('新板块是空白的（0 条）', before && before.items === 0, JSON.stringify(before))

  // ———————— 2. 从零写：流式 → 校验 → 采纳 ————————
  await evalJs(`window.__mrTestAi.setResult(${JSON.stringify(GENERATED)})`)
  await evalJs(`window.__mrTestAi.open(${JSON.stringify(sid)})`)
  await sleep(200)
  let s = await aiState()
  check('浮层已打开', s.open === true)
  check('空板块自动进入「从零写」模式', s.mode === 'generate', s.mode)

  await evalJs(`window.__mrTestAi.setAnswers('2025 年初在某律所实习三个月，主要整理民事案件卷宗、做类案检索')`)
  const probeGen = await evalJs(`window.__mrTestAi.probeTransport()`)
  check(
    '「从零写」的参数也能通过 IPC 序列化',
    probeGen?.ok === true && !/clone/i.test(probeGen?.error ?? ''),
    JSON.stringify(probeGen)
  )
  const runP = evalJs(`window.__mrTestAi.run()`)

  // 流式中途：文档必须一字未改
  await sleep(120)
  s = await aiState()
  check('生成过程中状态是「streaming」', s.status === 'streaming', s.status)
  check('生成过程中还不能采纳', s.canAccept === false)
  const mid = await sectionSnapshot(sid)
  check('生成过程中文档一字未改', mid && mid.items === 0, JSON.stringify(mid))

  await runP
  await sleep(150)
  s = await aiState()
  check('生成完成', s.status === 'done', s.status)
  check('校验通过、可以采纳', s.canAccept === true)
  s = await aiState()
  check('解析出 1 组内容', Array.isArray(s.groups) && s.groups.length === 1, JSON.stringify(s.groups))
  check('仍然没有写入文档', (await sectionSnapshot(sid)).items === 0)

  await evalJs(`window.__mrTestAi.accept()`)
  await sleep(400)
  check('采纳后浮层关闭', (await aiState()).open === false)
  const after = await sectionSnapshot(sid)
  check('采纳后板块里真的多了一条', after.items === 1, JSON.stringify(after))
  const joined = (after.values ?? []).join(' | ')
  check('事实字段写进了正确位置（单位/时间/职务）', /某某律师事务所/.test(joined) && /2025\.01-2025\.03/.test(joined) && /实习生/.test(joined), joined.slice(0, 80))
  check('正文内容也写进去了', /卷宗/.test(joined), joined.slice(0, 80))

  // ———————— 3. 润色：只改措辞，事实字段必须原样保留 ————————
  await evalJs(`window.__mrTestAi.setResult(${JSON.stringify(REWRITTEN)})`)
  await evalJs(`window.__mrTestAi.open(${JSON.stringify(sid)})`)
  await sleep(200)
  s = await aiState()
  check('有内容后自动进入「润色改写」模式', s.mode === 'rewrite', s.mode)

  await evalJs(`window.__mrTestAi.setInstruction('更简洁一点')`)

  // 参数必须能跨进程传递：Vue 响应式代理会在这里报 "An object could not be cloned."
  // 这条走的是**真实 IPC 通道**（假执行器绕不过序列化，所以必须单独验一遍）
  const probe = await evalJs(`window.__mrTestAi.probeTransport()`)
  check(
    'AI 参数能通过 IPC 序列化',
    probe?.ok === true && !/clone/i.test(probe?.error ?? ''),
    JSON.stringify(probe)
  )

  await evalJs(`window.__mrTestAi.run()`)
  await sleep(200)
  s = await aiState()
  check('改写完成', s.status === 'done', s.status)
  check('改写结果只有 1 组（与原文条数一致）', Array.isArray(s.groups) && s.groups.length === 1)

  await evalJs(`window.__mrTestAi.accept()`)
  await sleep(400)
  const after2 = await sectionSnapshot(sid)
  const joined2 = (after2.values ?? []).join(' | ')
  check('正文被替换成了新版本', /证据目录/.test(joined2), joined2.slice(0, 90))
  check('时间等事实字段没有被改动', /2025\.01-2025\.03/.test(joined2) && /某某律师事务所/.test(joined2))

  // ———————— 3.9 可选：用真实模型再跑一次（REAL_AI=1 才执行，会消耗少量额度） ————————
  if (process.env.REAL_AI === '1') {
    await evalJs(`window.__mrTestAi.clearResult()`) // 换回真实通道
    await evalJs(`window.__mrTestAi.open(${JSON.stringify(sid)})`)
    await sleep(250)
    await evalJs(`window.__mrTestAi.setInstruction('更简洁一点')`)
    await evalJs(`window.__mrTestAi.run()`)
    let real = null
    for (let i = 0; i < 40; i++) {
      await sleep(1000)
      real = await aiState()
      if (real.status === 'done' || real.status === 'error') break
    }
    check('真实模型能跑通润色（不再报 could not be cloned）', real?.status === 'done', `${real?.status} ${real?.error || ''}`)
    check('真实模型返回了 1 组内容', Array.isArray(real?.groups) && real.groups.length === 1)
    await evalJs(`window.__mrTestAi.close()`)
  }

  // ———————— 4. 模型返回条数对不上 → 报错且文档不变 ————————
  await evalJs(`window.__mrTestAi.setResult('@@1\\n- 甲\\n@@2\\n- 乙')`)
  await evalJs(`window.__mrTestAi.open(${JSON.stringify(sid)})`)
  await sleep(200)
  await evalJs(`window.__mrTestAi.run()`)
  await sleep(300)
  s = await aiState()
  check('条数对不上时报错', s.status === 'error', s.status)
  check('错误说明了「对不上」', /对不上/.test(s.error), s.error)
  check('报错时无法采纳', s.canAccept === false)
  check('报错时文档没被改动', (await sectionSnapshot(sid)).items === 1)

  // ———————— 5. 取消：中止生成，文档不变 ————————
  await evalJs(`window.__mrTestAi.setResult(${JSON.stringify('@@1\\n- ' + '长内容'.repeat(200))})`)
  await evalJs(`window.__mrTestAi.open(${JSON.stringify(sid)})`)
  await sleep(200)
  void evalJs(`window.__mrTestAi.run()`) // 不等待
  await sleep(150)
  check('取消前处于生成中', (await aiState()).status === 'streaming')
  await evalJs(`window.__mrTestAi.cancel()`)
  await sleep(400)
  s = await aiState()
  check('取消后回到空闲状态', s.status === 'idle', s.status)
  check('取消后没有报错', s.error === '', s.error)
  check('取消后文档没被改动', (await sectionSnapshot(sid)).items === 1)
  await evalJs(`window.__mrTestAi.close()`)

  // ———————— 6. 全文诊断：幻觉板块 id 必须被丢弃 ————————
  const diagJson = DIAGNOSIS.replace('<SECTION_ID>', sid)
  await evalJs(`window.__mrTestAi.setResult(${JSON.stringify(diagJson)})`)
  await evalJs(`window.__mrTestAi.diagnose()`)
  await sleep(200)
  check('诊断浮层已打开', (await dgState()).open === true)
  await evalJs(`window.__mrTestAi.runDiagnose()`)
  await sleep(300)
  let dg = await dgState()
  check('诊断完成', dg.status === 'done', dg.status)
  check('摘要已显示', typeof dg.summary === 'string' && dg.summary.length > 0, dg.summary)
  check('指向不存在板块的问题被丢弃（只剩 1 条）', dg.issues.length === 1, JSON.stringify(dg.issues.map((i) => i.sectionId)))
  check('保留下来的问题指向真实板块', dg.issues[0]?.sectionId === sid)
  check('界面上渲染出了问题条目', await evalJs(`document.querySelectorAll('.dg-item').length === 1`))
  check('界面上有「让 AI 改」按钮', await evalJs(`!!document.querySelector('.dg-fix')`))

  // 点「让 AI 改」→ 跳到板块浮层并预填要求
  await evalJs(`document.querySelector('.dg-fix')?.click()`)
  await sleep(400)
  s = await aiState()
  check('点「让 AI 改」后打开了板块浮层', s.open === true)
  check('修改要求已预填', /量化|卷宗/.test(s.instruction), s.instruction)
  check('诊断浮层已关闭', (await dgState()).open === false)
  await evalJs(`window.__mrTestAi.close()`)

  // ———————— 7. 基本信息的板块不提供 AI（姓名不能被改写） ————————
  check(
    '基本信息板块上没有 ✨AI 按钮',
    await evalJs(`(() => {
      const cards = [...document.querySelectorAll('.section-card')]
      const basic = cards[0]
      return !!basic && !basic.querySelector('.act.ai')
    })()`)
  )
  check('其他板块有 ✨AI 按钮', await evalJs(`document.querySelectorAll('.act.ai').length > 0`))

  // ———————— 8. 导入对话框的进度不会被润色任务串台 ————————
  await evalJs(`window.__mrTestAi.clearResult()`) // 恢复真实通道（不再走假数据）
  check(
    '进度订阅按 taskId 过滤（导入对话框已带 taskId 字段）',
    await evalJs(`!!window.__mrTestAi && !!window.__mrTestTabs`)
  )

  // ———————— 收尾 ————————
  for (const t of await tabs()) {
    if (t.kind === 'doc') await evalJs(`window.__mrTestTabs.close(${JSON.stringify(t.id)})`)
  }
  await sleep(400)
  await evalJs(`(async () => {
    const all = await window.myresume.file.autorecoverRead()
    for (const d of all) await window.myresume.file.autorecoverClear(d.id)
  })()`)
  check('收尾后回到只有首页标签', (await tabs()).length === 1)

  console.log('=== 结论 ===')
  console.log(failures === 0 ? '全部通过' : `${failures} 项失败`)
  if (consoleErrors.length) console.log('控制台异常:\n' + consoleErrors.slice(0, 5).join('\n———\n'))
  else console.log('无控制台异常')
  ws.close()
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error('自测脚本异常:', e.message)
  process.exit(1)
})
