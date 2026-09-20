// 题目音频播放链路实证（服务端腾讯云语音合成版）。
//
// 目的：证明在「浏览器完全不支持 speechSynthesis」的手机环境（微信 X5 / 各类
// WebView）下，题目音频仍能通过服务端合成的音频 + 原生 <audio> 正常播放，
// 且播放次数严格按「确认出声」扣减。
//
// 云合成能力是否开通不影响本脚本：/api/tts/* 用本地桩响应（浏览器原生可解码的
// WAV），被测对象是前端播放链路与服务端契约（URL 参数、降级行为）。
// 真实云端合成请用：node scripts/check-tts.mjs（需先在控制台开通语音合成）。
//
// 运行：
//   1) 先起一个可访问 dist 的服务：npx vite preview --port 4180 --host
//   2) NODE_PATH=<playwright-core 所在 node_modules> BASE=http://127.0.0.1:4180 \
//      node scripts/verify-audio-playback.cjs

const { chromium, devices } = require('playwright-core')

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const BASE = process.env.BASE || 'http://localhost:4180'

const results = []
function check(name, ok, detail) {
  results.push({ name, ok })
  console.log((ok ? '[PASS] ' : '[FAIL] ') + name + (detail ? '  -> ' + detail : ''))
}

// ── 造一段浏览器原生可解码的 WAV（1 秒 440Hz 单声道 16k）作为服务端桩音频 ──
function buildWav(seconds = 1.0, sampleRate = 16000) {
  const n = Math.floor(seconds * sampleRate)
  const data = Buffer.alloc(n * 2)
  for (let i = 0; i < n; i++) {
    const v = Math.round(Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 8000)
    data.writeInt16LE(v, i * 2)
  }
  const header = Buffer.alloc(44)
  header.write('RIFF', 0, 'latin1')
  header.writeUInt32LE(36 + data.length, 4)
  header.write('WAVE', 8, 'latin1')
  header.write('fmt ', 12, 'latin1')
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20) // PCM
  header.writeUInt16LE(1, 22) // 单声道
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(sampleRate * 2, 28)
  header.writeUInt16LE(2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36, 'latin1')
  header.writeUInt32LE(data.length, 40)
  return Buffer.concat([header, data])
}

const WAV = buildWav()

async function remainText(page) {
  const el = page.locator('p:has-text("剩余播放次数")').first()
  if (!(await el.count())) return ''
  return (await el.innerText()).trim()
}

function initScript() {
  // [!] 把语音合成 API 整个抹掉，等价于微信 X5 / 不支持 TTS 的手机浏览器
  try {
    Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true })
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: undefined, configurable: true })
  } catch (e) {
    /* ignore */
  }
  // 记录 <audio> 真实事件，作为「确实开始播放」的机械证据
  window.__audioLog = []
  const orig = HTMLMediaElement.prototype.play
  HTMLMediaElement.prototype.play = function () {
    const src = this.currentSrc || this.src
    window.__audioLog.push({ ev: 'play-call', src })
    this.addEventListener('playing', () => window.__audioLog.push({ ev: 'playing', src }), { once: true })
    this.addEventListener(
      'loadedmetadata',
      () => window.__audioLog.push({ ev: 'loadedmetadata', src, dur: this.duration }),
      { once: true }
    )
    this.addEventListener('ended', () => window.__audioLog.push({ ev: 'ended', src }), { once: true })
    this.addEventListener(
      'error',
      () => window.__audioLog.push({ ev: 'error', src, code: this.error && this.error.code }),
      { once: true }
    )
    return orig.apply(this, arguments)
  }
}

/** 用桩服务端跑一遍移动端主流程 */
async function runPlaybackScenario(browser, gradeIndex, ttsRequests, httpErrors, consoleErrs) {
  const ctx = await browser.newContext({
    ...devices['iPhone 13'],
    ignoreHTTPSErrors: true,
    permissions: ['microphone']
  })
  await ctx.addInitScript(initScript)
  const page = await ctx.newPage()

  await page.route('**/api/tts/health', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, enabled: true, configured: true, library: true, maxTextLength: 500 })
    })
  )
  await page.route('**/api/tts/audio*', async (route) => {
    const u = new URL(route.request().url())
    ttsRequests.push({ text: u.searchParams.get('text') || '', voice: u.searchParams.get('voice') || '' })
    await route.fulfill({
      status: 200,
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Length': String(WAV.length),
        'Cache-Control': 'no-store'
      },
      body: WAV
    })
  })

  page.on('response', (r) => {
    if (r.status() >= 400) httpErrors.push(r.status() + ' ' + r.url())
  })
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrs.push(m.text())
  })
  page.on('requestfailed', (r) => {
    if (!/favicon/.test(r.url())) httpErrors.push('FAILED ' + r.url() + ' ' + (r.failure() && r.failure().errorText))
  })

  await page.goto(BASE, { waitUntil: 'load' })
  check('页面加载：年级卡片 3 个', (await page.locator('.grade-card').count()) === 3)

  await page.locator('.grade-card').nth(gradeIndex).click()
  await page.getByRole('button', { name: /开始测评/ }).click()
  await page.locator('p.progress-text').waitFor({ timeout: 5000 })
  check('进入第 1 题（听后选择）', (await page.locator('p.progress-text').innerText()).includes('1 / 5'))

  // ── 服务端合成就绪时不得预先降级 ──────────────────────────────────────────
  await page.waitForTimeout(300)
  check('合成能力就绪时不预先展示听力原文', (await page.getByText('听力原文').count()) === 0)

  const before = await remainText(page)
  check('初始剩余播放次数为 2', /2/.test(before), before)

  // ── 播放第 1 题 ──────────────────────────────────────────────────────────
  await page.getByRole('button', { name: '播放录音' }).click()
  await page.waitForTimeout(2200)

  const log1 = await page.evaluate(() => window.__audioLog)
  const played = log1.filter((e) => e.ev === 'playing')
  const meta = log1.find((e) => e.ev === 'loadedmetadata')
  const errs = log1.filter((e) => e.ev === 'error')
  check('原生 <audio> 真的开始播放（playing 事件）', played.length === 1, JSON.stringify(played.map((p) => p.ev)))
  check('音频元数据已解析（duration > 0）', !!meta && meta.dur > 0, meta ? 'duration=' + meta.dur.toFixed(2) + 's' : '无')
  check('无音频解码错误', errs.length === 0, JSON.stringify(errs))

  const after = await remainText(page)
  check('播放次数按「确认出声」扣减 1', /1/.test(after), before + ' -> ' + after)
  check('未出现「浏览器无法播放语音」提示', (await page.getByText('无法播放语音').count()) === 0)

  // ── 请求契约：URL 必须携带题库原文，走服务端合成 ─────────────────────────
  check('已请求服务端合成接口 /api/tts/audio', ttsRequests.length >= 1, JSON.stringify(ttsRequests[0] || {}))
  check(
    '请求携带题库原文（text 参数非空且为英文题面）',
    !!ttsRequests[0] && /[A-Za-z]{3}/.test(ttsRequests[0].text) && ttsRequests[0].text.length > 10,
    ttsRequests[0] ? ttsRequests[0].text.slice(0, 60) + '…' : '无'
  )
  check('voice 参数为 auto（由服务端按角色分声）', !ttsRequests[0] || ttsRequests[0].voice === 'auto', ttsRequests[0] && ttsRequests[0].voice)

  // ── 播放中切题：不得把下一题按钮永久卡在「播放中…」────────────────────────
  await page.locator('.option').nth(1).click()
  await page.getByRole('button', { name: '下一题' }).click()
  await page.waitForTimeout(500)
  check('切题后进入第 2 题', (await page.locator('p.progress-text').innerText()).includes('2 / 5'))
  const btn2 = page.getByRole('button', { name: '播放录音' })
  check('切题后按钮未卡在「播放中…」', await btn2.isVisible(), await btn2.innerText())

  await btn2.click()
  await page.waitForTimeout(400)
  await page.locator('.option').nth(0).click()
  await page.getByRole('button', { name: '下一题' }).click() // 播放中切题
  await page.waitForTimeout(600)
  check('播放中切题：进入第 3 题', (await page.locator('p.progress-text').innerText()).includes('3 / 5'))

  const log3 = await page.evaluate(() => window.__audioLog.filter((e) => e.ev === 'playing'))
  check('累计出声 2 次（第 1、2 题）', log3.length === 2, 'playing 累计 ' + log3.length + ' 次')

  // ── 第 3 题：模仿朗读，走示范朗读按钮 ───────────────────────────────────
  const demoBtn = page.getByRole('button', { name: '听示范朗读' })
  check('朗读题展示「听示范朗读」按钮', await demoBtn.isVisible())
  await demoBtn.click()
  await page.waitForTimeout(1200)
  const log4 = await page.evaluate(() => window.__audioLog.filter((e) => e.ev === 'playing'))
  check('示范朗读可播放', log4.length === 3, 'playing 累计 ' + log4.length + ' 次')

  // ── 次数用尽：按钮禁用且文案明确 ────────────────────────────────────────
  await demoBtn.click()
  await page.waitForTimeout(1200)
  const exhausted = page.getByRole('button', { name: '播放次数已用完' })
  check('次数用尽后按钮文案变为「播放次数已用完」', await exhausted.isVisible())
  check('次数用尽后按钮不可点击', await exhausted.isDisabled())

  await ctx.close()
}

/** 服务端合成不可用（health ok:false）时的降级行为 */
async function runDegradedScenario(browser, httpErrors, consoleErrs) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], ignoreHTTPSErrors: true })
  await ctx.addInitScript(initScript)
  const page = await ctx.newPage()
  await page.route('**/api/tts/health', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: false, enabled: true, configured: false, library: true, maxTextLength: 500 })
    })
  )
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrs.push(m.text())
  })

  await page.goto(BASE, { waitUntil: 'load' })
  await page.locator('.grade-card').first().click()
  await page.getByRole('button', { name: /开始测评/ }).click()
  await page.locator('p.progress-text').waitFor({ timeout: 5000 })
  await page.waitForTimeout(500)

  check(
    '合成不可用时提前降级展示听力原文',
    (await page.getByText('听力原文').count()) > 0,
    '降级提示已出现'
  )

  const before = await remainText(page)
  await page.getByRole('button', { name: '播放录音' }).click()
  await page.waitForTimeout(800)
  const after = await remainText(page)
  check('合成不可用时给出明确提示', (await page.getByText('服务端语音合成暂不可用').count()) > 0)
  check('失败不扣减播放次数', before === after, before + ' -> ' + after)
  await ctx.close()
}

;(async () => {
  if (!require('fs').existsSync(CHROME)) {
    console.error('未找到 Chrome：' + CHROME)
    process.exit(2)
  }

  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: [
      '--autoplay-policy=no-user-gesture-required',
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--ignore-certificate-errors',
      '--mute-audio'
    ]
  })

  const ttsRequests = []
  const httpErrors = []
  const consoleErrs = []

  await runPlaybackScenario(browser, 0, ttsRequests, httpErrors, consoleErrs)

  const badReq = ttsRequests.filter((r) => !r.text)
  check(
    '所有合成请求都带题库文本（无空文本请求）',
    ttsRequests.length > 0 && badReq.length === 0,
    ttsRequests.map((r) => r.text.slice(0, 24) + '…').join(' | ')
  )

  await runDegradedScenario(browser, httpErrors, consoleErrs)

  check('无 4xx/5xx 请求', httpErrors.length === 0, httpErrors.join(' | ').slice(0, 300))
  check('无页面级 JS 错误', consoleErrs.length === 0, consoleErrs.join(' | ').slice(0, 300))

  // ── P0 规则：UI 不得出现 emoji 功能图标 ─────────────────────────────────
  const ctx = await browser.newContext({ ...devices['iPhone 13'], ignoreHTTPSErrors: true })
  const page = await ctx.newPage()
  await page.route('**/api/tts/health', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
  )
  await page.goto(BASE, { waitUntil: 'load' })
  const bodyText = await page.evaluate(() => document.body.innerText)
  const EMOJI =
    /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE0F}\u{1F000}-\u{1F02F}\u{1F100}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FAFF}\u{200D}\u{20E3}]/u
  check('P0：页面无 emoji 功能图标', !EMOJI.test(bodyText))
  await ctx.close()

  await browser.close()

  const failed = results.filter((r) => !r.ok)
  console.log('\n===== 合计 ' + results.length + ' 项，失败 ' + failed.length + ' 项 =====')
  if (failed.length) {
    failed.forEach((f) => console.log('  未通过：' + f.name))
    process.exit(1)
  }
})().catch((e) => {
  console.error('实证脚本异常：', e)
  process.exit(2)
})
