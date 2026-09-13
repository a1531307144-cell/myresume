// 标签页自测：通过 CDP 驱动真实应用，验证单窗口多标签的核心不变量。
// 最关键的一条：在 A 标签里的编辑必须写回 A 文件，绝不能串到 B 文件。
//
// 用法: node scripts/selftest-tabs.mjs
// 前提: 先以开发模式启动应用（npm run dev）。
// 注意: 脚本会关掉所有简历标签来归一化起始状态，**请在确认没有正在编辑的简历时运行**。
//       它只会清掉自己写出的草稿（姓名为「张三 / 李四」），不会碰你的真实草稿。
import { readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CDP_PORT = 9222
const FIXTURE_A = join(tmpdir(), 'mr-tabtest-a.myresume')
const FIXTURE_B = join(tmpdir(), 'mr-tabtest-b.myresume')

function fixture(id, name) {
  const now = new Date().toISOString()
  return {
    app: 'MyResume',
    schemaVersion: 1,
    id,
    createdAt: now,
    updatedAt: now,
    meta: { template: 'law-classic' },
    sections: [
      { id: `${id}-basic`, type: 'basicInfo', title: '基本信息', data: { name, photo: null, contacts: [] } },
      { id: `${id}-edu`, type: 'education', title: '教育背景', data: { items: [] } }
    ]
  }
}

/**
 * 找到应用主窗口页面。应用可能正因热更新重载，CDP 端口会短暂不可用——
 * 直接抓会失败并报成「找不到窗口」的假故障，所以这里重试几次。
 */
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
  const activeId = () => evalJs(`window.__mrTestTabs.activeId()`)
  const setInput = (v) =>
    evalJs(`(() => {
      const el = document.querySelector('.app-editor .ed-inp')
      if (!el) return 'NO_INPUT'
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      setter.call(el, ${JSON.stringify(v)})
      el.dispatchEvent(new Event('input', { bubbles: true }))
      return 'SET'
    })()`)
  const readInput = () => evalJs(`document.querySelector('.app-editor .ed-inp')?.value ?? null`)

  // ———————— 0. 应用挂载（模板报错会在这里立刻暴露，而不是等到超时） ————————
  // 先整页重载一次：把可能正在进行的 HMR 热更新冲刷干净。
  // 否则改完代码紧接着跑本脚本时，重载会在中途重置标签，造成「首跑失败、再跑通过」的假故障。
  await evalJs(`location.reload()`)
  await sleep(3200)

  check('应用已挂载（#app 有内容）', await evalJs(`(document.querySelector('#app')?.children.length ?? 0) > 0`))
  check('顶栏存在', await evalJs(`!!document.querySelector('.app-topbar')`))
  check('标签条存在', await evalJs(`!!document.querySelector('.tab-bar')`))

  // 归一化起始状态：清掉上一轮遗留的简历标签（首页标签保留），让脚本可重复运行
  for (const t of await tabs()) {
    if (t.kind === 'doc') await evalJs(`window.__mrTestTabs.close(${JSON.stringify(t.id)})`)
  }
  await sleep(400)

  // ———————— 1. 初始只有一个「首页」标签 ————————
  let t = await tabs()
  check('初始只有 1 个标签', t.length === 1, JSON.stringify(t.map((x) => x.name)))
  check('它是首页标签', t[0]?.kind === 'home')
  check('首页渲染的是起始页', await evalJs(`!!document.querySelector('.start-page')`))
  check('首页不显示文档类按钮（导出 PDF）', !(await evalJs(`!!document.querySelector('.tb-btn.export')`)))

  // ———————— 2. 新建多个标签 ————————
  const a = await evalJs(`window.__mrTestTabs.newDoc()`)
  await sleep(150)
  const b = await evalJs(`window.__mrTestTabs.newDoc()`)
  await sleep(200)
  t = await tabs()
  check('新建后共 3 个标签', t.length === 3, JSON.stringify(t.map((x) => x.name)))
  check('首页仍排第一', t[0].kind === 'home')
  check('已切到新建的简历标签', (await activeId()) === b)
  check('编辑器已渲染', await evalJs(`!!document.querySelector('.app-editor')`))
  check('预览已渲染', await evalJs(`!!document.querySelector('.app-preview')`))
  check('起始页已让位', !(await evalJs(`!!document.querySelector('.start-page')`)))
  check('文档类按钮回来了（导出 PDF）', await evalJs(`!!document.querySelector('.tb-btn.export')`))

  // ———————— 3. 内容随标签隔离（核心不变量） ————————
  check('能定位到姓名输入框', (await setInput('张三')) === 'SET')
  await sleep(200)
  check('输入后标签被标记为未保存', (await tabs()).find((x) => x.id === b)?.dirty === true)

  await evalJs(`window.__mrTestTabs.activate(${JSON.stringify(a)})`)
  await sleep(300)
  check('切到另一个标签后姓名框是空的', (await readInput()) === '', `实际=${await readInput()}`)
  await setInput('李四')
  await sleep(150)

  await evalJs(`window.__mrTestTabs.activate(${JSON.stringify(b)})`)
  await sleep(300)
  check('切回标签后内容仍然是「张三」', (await readInput()) === '张三', `实际=${await readInput()}`)

  const beforeDirty = (await tabs()).filter((x) => x.dirty).length
  await evalJs(`window.__mrTestTabs.activate(${JSON.stringify(a)})`)
  await sleep(250)
  const afterDirty = (await tabs()).filter((x) => x.dirty).length
  check('来回切标签不会新增「未保存」标记', afterDirty === beforeDirty, `${beforeDirty} → ${afterDirty}`)

  // ———————— 4. 关闭标签 ————————
  await evalJs(`window.__mrTestTabs.close(${JSON.stringify(a)})`)
  await sleep(300)
  t = await tabs()
  check('关闭后剩 2 个标签', t.length === 2, JSON.stringify(t.map((x) => x.name)))
  check('被关掉的标签确实没了', !t.some((x) => x.id === a))

  // ———————— 5. 关闭「有未保存内容」的标签必须先弹确认 ————————
  await evalJs(`window.__mrTestTabs.activate(${JSON.stringify(b)})`)
  await sleep(250)
  await evalJs(`document.querySelector('.tab.active .tab-close')?.click()`)
  await sleep(400)
  check('关闭未保存标签时弹出确认框', await evalJs(`!!document.querySelector('.modal-mask')`))
  check(
    '确认框提到「未保存」',
    /未保存/.test(await evalJs(`document.querySelector('.modal-text')?.textContent ?? ''`))
  )
  await evalJs(
    `(() => { const bs = [...document.querySelectorAll('.modal-btn')]; const c = bs.find((x) => x.textContent.trim() === '取消'); c?.click(); return !!c })()`
  )
  await sleep(400)
  check('点「取消」后确认框关闭', !(await evalJs(`!!document.querySelector('.modal-mask')`)))
  check('点「取消」后标签仍然在', (await tabs()).length === 2)
  check('点「取消」后内容仍然在', (await readInput()) === '张三')

  // ———————— 6. 首页往返 ————————
  const homeId = (await tabs()).find((x) => x.kind === 'home').id
  await evalJs(`window.__mrTestTabs.activate(${JSON.stringify(homeId)})`)
  await sleep(300)
  check('切到首页后显示起始页', await evalJs(`!!document.querySelector('.start-page')`))
  check('首页显示「返回正在编辑的简历」按钮', await evalJs(`!!document.querySelector('.back-btn')`))
  await evalJs(`document.querySelector('.back-btn')?.click()`)
  await sleep(300)
  check('点返回后回到简历标签', (await activeId()) === b)
  check('回到简历后内容还在', (await readInput()) === '张三')

  await evalJs(`window.__mrTestTabs.close(${JSON.stringify(homeId)})`)
  await sleep(200)
  check('首页标签关不掉', (await tabs()).some((x) => x.kind === 'home'))

  // ———————— 7. 存盘隔离：A 的编辑只写进 A 文件 ————————
  // 这是整条重构里风险最高的一环（保存链路从「按窗口」改成「按标签」）
  await writeFile(FIXTURE_A, JSON.stringify(fixture('fixt-a', '原甲'), null, 2), 'utf-8')
  await writeFile(FIXTURE_B, JSON.stringify(fixture('fixt-b', '原乙'), null, 2), 'utf-8')

  await evalJs(`window.__mrTest.openPath(${JSON.stringify(FIXTURE_A)})`)
  await sleep(700)
  await evalJs(`window.__mrTest.openPath(${JSON.stringify(FIXTURE_B)})`)
  await sleep(700)

  t = await tabs()
  const fixtureTabs = () => t.filter((x) => x.name.startsWith('mr-tabtest-'))
  const tabA = t.find((x) => x.name === 'mr-tabtest-a')
  const tabB = t.find((x) => x.name === 'mr-tabtest-b')
  check('两个文件各占一个标签', Boolean(tabA) && Boolean(tabB), JSON.stringify(t.map((x) => x.name)))
  check('没有多开出第三个测试标签', fixtureTabs().length === 2)

  await evalJs(`window.__mrTestTabs.activate(${JSON.stringify(tabA.id)})`)
  await sleep(400)
  check('A 标签显示的是 A 自己的内容', (await readInput()) === '原甲', `实际=${await readInput()}`)

  await setInput('新甲')
  await sleep(2000) // 等自动保存（1 秒防抖 + 写盘）

  const diskA = JSON.parse(await readFile(FIXTURE_A, 'utf-8'))
  const diskB = JSON.parse(await readFile(FIXTURE_B, 'utf-8'))
  check('A 的修改已自动写回 A 文件', diskA.sections[0].data.name === '新甲', `磁盘上=${diskA.sections[0].data.name}`)
  check('B 文件完全没被牵连', diskB.sections[0].data.name === '原乙', `磁盘上=${diskB.sections[0].data.name}`)
  check('写盘后 A 标签不再是「未保存」', (await tabs()).find((x) => x.id === tabA.id)?.dirty === false)

  // 同一份文件再打开一次 → 应当切回已有标签，而不是开出第三个
  await evalJs(`window.__mrTest.openPath(${JSON.stringify(FIXTURE_A)})`)
  await sleep(700)
  t = await tabs()
  check(
    '重复打开同一文件不会多开标签',
    t.filter((x) => x.name.startsWith('mr-tabtest-')).length === 2,
    JSON.stringify(t.map((x) => x.name))
  )
  check('并且切回了已有的那个标签', (await activeId()) === tabA.id)

  // ———————— 8. 关闭守卫：窗口里到底有没有「未保存的内容」 ————————
  // 「关标签 / 关软件时提示保存」就是靠这个标记触发的，所以它必须准
  const dirtyNow = () => evalJs(`window.myresume.app.__testWindowDirty()`)
  const clearTestDrafts = () =>
    evalJs(`(async () => {
      const all = await window.myresume.file.autorecoverRead()
      let n = 0
      for (const d of all) {
        const nm = d.doc?.sections?.find((s) => s.type === 'basicInfo')?.data?.name
        if (nm === '张三' || nm === '李四') { await window.myresume.file.autorecoverClear(d.id); n++ }
      }
      return n
    })()`)

  await clearTestDrafts()
  for (const x of await tabs()) {
    if (x.kind === 'doc') await evalJs(`window.__mrTestTabs.close(${JSON.stringify(x.id)})`)
  }
  await sleep(400)
  check('当前窗口没有未保存内容', (await dirtyNow()) === false)

  const c = await evalJs(`window.__mrTestTabs.newDoc()`)
  await sleep(300)
  await setInput('张三')
  await sleep(500)
  check('有新简历没保存时，窗口标记为「有未保存内容」', (await dirtyNow()) === true)
  check('该标签确实处于未保存状态', (await tabs()).find((x) => x.id === c)?.dirty === true)

  // ———————— 9. 草稿提示：左下角、10 秒自动消失、消失不删草稿 ————————
  await sleep(1600) // 等防抖自动保存把草稿写到磁盘
  await evalJs(`location.reload()`)
  await sleep(2600)

  check('重载后弹出草稿提示', await evalJs(`!!document.querySelector('.draft-notice')`))
  const noticeText = (await evalJs(`document.querySelector('.draft-notice')?.textContent ?? ''`)).replace(/\s+/g, ' ')
  check('提示写明了份数', /1 份/.test(noticeText), noticeText.trim().slice(0, 50))
  check(
    '提示带「恢复」和「丢弃」按钮',
    (await evalJs(
      `[...document.querySelectorAll('.draft-notice .dn-btn')].map((b) => b.textContent.trim()).join('|')`
    )) === '恢复|丢弃'
  )
  check(
    '提示在左下角',
    await evalJs(`(() => {
      const el = document.querySelector('.draft-notice')
      if (!el) return false
      const r = el.getBoundingClientRect()
      return r.left < window.innerWidth / 2 && r.top > window.innerHeight / 2
    })()`)
  )
  check('重载后窗口不再有未保存标记（标签已重置）', (await dirtyNow()) === false)

  await sleep(11000)
  check('10 秒不理会会自动消失', !(await evalJs(`!!document.querySelector('.draft-notice')`)))

  await evalJs(`location.reload()`)
  await sleep(2600)
  check('自动消失不会删掉草稿：下次启动仍然提示', await evalJs(`!!document.querySelector('.draft-notice')`))
  await evalJs(
    `[...document.querySelectorAll('.draft-notice .dn-btn')].find((b) => b.textContent.trim() === '恢复')?.click()`
  )
  await sleep(700)
  check('点「恢复」后草稿变成了标签', (await tabs()).some((x) => x.kind === 'doc'))
  check('恢复出来的内容正确', (await readInput()) === '张三', `实际=${await readInput()}`)

  // ———————— 收尾：清掉测试标签、临时文件与本次自测写出的草稿 ————————
  for (const x of await tabs()) {
    if (x.kind === 'doc') await evalJs(`window.__mrTestTabs.close(${JSON.stringify(x.id)})`)
  }
  await sleep(400)
  await rm(FIXTURE_A, { force: true })
  await rm(FIXTURE_B, { force: true })
  // 只清姓名为「张三 / 李四」的草稿——那是本次自测写出来的；绝不动用户自己的草稿
  const clearedDrafts = await evalJs(`(async () => {
    const all = await window.myresume.file.autorecoverRead()
    let n = 0
    for (const d of all) {
      const nm = d.doc?.sections?.find((s) => s.type === 'basicInfo')?.data?.name
      if (nm === '张三' || nm === '李四') { await window.myresume.file.autorecoverClear(d.id); n++ }
    }
    return n
  })()`)
  check('收尾后回到只有首页标签', (await tabs()).length === 1)
  console.log(`  (清掉本次自测产生的草稿 ${clearedDrafts} 份)`)

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
