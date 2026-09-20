// 服务端语音合成 · 逻辑单元测试（不依赖网络与云端开通状态）
//
// 覆盖容易出错、且一旦出错就会「用户听不到声音」的关键逻辑：
//   1) 角色切段：Boy/Man → 男声，Girl/Woman → 女声，无标记 → 旁白
//   2) 超长文本按句切分，保证每段都在 Text 长度限制内
//   3) mp3 拼接：剥离各段 ID3 头，帧流连续（中间出现 ID3 会导致部分播放器跳帧）
//   4) 缓存键：同文本同参数稳定；音色/语速不同必须换键
//   5) 文本白名单与长度校验（防止公开接口被拿来刷云端配额）
//   6) Range 解析：<audio> 预载/拖动请求要能正确切片
//
// 用法：node scripts/test-tts.mjs

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseRange } from '../server/http-util.mjs'

process.env.TTS_SECRET_ID = process.env.TTS_SECRET_ID || 'test-id'
process.env.TTS_SECRET_KEY = process.env.TTS_SECRET_KEY || 'test-key'
process.env.SOE_ALLOW_ORIGIN = '*'

const tts = await import('../server/tts.mjs')
const { splitByRole, splitLong, concatMp3, stripId3, sampleRateFor, cacheKey, MAX_TEXT_LENGTH } = tts.internals

// ── 构造假 mp3（带 ID3v2 头 + 假帧数据），用于验证拼接与剥离 ────────────────
function fakeMp3(frameLen, tagLen = 0) {
  const parts = []
  if (tagLen > 0) {
    const header = Buffer.alloc(10)
    header.write('ID3', 0, 'latin1')
    // syncsafe 长度：每字节 7 位
    header[6] = (tagLen >> 21) & 0x7f
    header[7] = (tagLen >> 14) & 0x7f
    header[8] = (tagLen >> 7) & 0x7f
    header[9] = tagLen & 0x7f
    parts.push(header, Buffer.alloc(tagLen))
  }
  const frame = Buffer.alloc(frameLen, 0xab)
  frame[0] = 0xff
  frame[1] = 0xfb // mp3 帧同步
  parts.push(frame)
  return Buffer.concat(parts)
}

test('角色切段：Boy/Man → male，Girl/Woman → female', () => {
  const segs = splitByRole('Boy: How are you? Girl: I am fine. Man: Good. Woman: Great.')
  assert.equal(segs.length, 4)
  assert.deepEqual(
    segs.map((s) => s.slot),
    ['male', 'female', 'male', 'female']
  )
  assert.equal(segs[0].text, 'How are you?')
  assert.equal(segs[3].text, 'Great.')
})

test('角色切段：无标记时整段走旁白音色', () => {
  const segs = splitByRole('My name is Lin Tao. I am a student in Grade Seven.')
  assert.equal(segs.length, 1)
  assert.equal(segs[0].slot, 'narrator')
})

test('角色切段：标记前的前言归到旁白', () => {
  const segs = splitByRole('Listen to the conversation. Boy: Hello. Girl: Hi.')
  assert.equal(segs.length, 3)
  assert.equal(segs[0].slot, 'narrator')
  assert.equal(segs[0].text, 'Listen to the conversation.')
})

test('超长文本按句切分且每段不超上限', () => {
  const long = Array.from({ length: 40 }, (_, i) => `This is sentence number ${i} for testing the splitter.`).join(' ')
  assert.ok(long.length > MAX_TEXT_LENGTH)
  const pieces = splitLong(long, 480)
  assert.ok(pieces.length > 1)
  for (const p of pieces) assert.ok(p.length <= 480, `段落超长：${p.length}`)
  // 切分不得丢内容
  assert.equal(pieces.join(' ').replace(/\s+/g, ' ').trim(), long.replace(/\s+/g, ' ').trim())
})

test('splitByRole：超长单角色段落也会被切分', () => {
  const long = 'Boy: ' + Array.from({ length: 40 }, (_, i) => `Sentence ${i} is here.`).join(' ')
  const segs = splitByRole(long)
  assert.ok(segs.length > 1)
  for (const s of segs) assert.equal(s.slot, 'male')
})

test('stripId3：剥离 ID3v2 头', () => {
  const withTag = fakeMp3(100, 64)
  const stripped = stripId3(withTag)
  assert.equal(stripped.length, 100)
  assert.notEqual(stripped.toString('latin1', 0, 3), 'ID3')
})

test('concatMp3：单段原样返回，多段剥离 ID3 后拼接', () => {
  const a = fakeMp3(200, 50)
  const b = fakeMp3(300, 70)
  assert.equal(concatMp3([a]).length, a.length)
  const merged = concatMp3([a, b])
  assert.equal(merged.length, 500)
  // 拼接结果中不应再出现 ID3 标记
  assert.equal(merged.toString('latin1').includes('ID3'), false)
})

test('concatMp3：空输入安全返回', () => {
  assert.equal(concatMp3([]).length, 0)
})

test('采样率：精品音色(1xxxxx) 16k，大模型音色 24k', () => {
  const cfg = { sampleRate: 0 }
  assert.equal(sampleRateFor('501008', cfg), 24000)
  assert.equal(sampleRateFor('501009', cfg), 24000)
  assert.equal(sampleRateFor('101050', cfg), 16000)
  // 显式配置优先
  assert.equal(sampleRateFor('501008', { sampleRate: 8000 }), 8000)
})

test('缓存键：同参数稳定，音色/语速变化必须换键', () => {
  const cfg = { voices: { male: '501008', female: '501009', narrator: '501009' }, speed: 0, sampleRate: 0 }
  const t = 'Boy: Hello there.'
  assert.equal(cacheKey(t, cfg), cacheKey(t, cfg))
  assert.notEqual(cacheKey(t, cfg), cacheKey(t + ' ', cfg))
  assert.notEqual(
    cacheKey(t, cfg),
    cacheKey(t, { ...cfg, voices: { male: '101050', female: '501009', narrator: '501009' } })
  )
  assert.notEqual(cacheKey(t, cfg), cacheKey(t, { ...cfg, speed: -1 }))
})

test('文本校验：空文本 / 纯符号被拒，题库文本放行', async () => {
  const cfg = tts.getConfig()
  await assert.rejects(() => tts.synthesize(''), (e) => e.code === 'TTS_TEXT_EMPTY')
  await assert.rejects(
    () => tts.synthesize('!!!???'),
    (e) => e.code === 'TTS_TEXT_INVALID'
  )
  await assert.rejects(
    () => tts.synthesize('a'.repeat(MAX_TEXT_LENGTH + 1)),
    (e) => e.code === 'TTS_TEXT_TOO_LONG'
  )
  // 非题库文本（allowAnyText=false 时）必须被白名单挡住
  if (!cfg.allowAnyText) {
    await assert.rejects(
      () => tts.synthesize('This text is definitely not in the question bank at all.'),
      (e) => e.code === 'TTS_TEXT_NOT_ALLOWED'
    )
  }
})

test('Range 解析：支持闭区间、开区间与越界收敛', () => {
  assert.deepEqual(parseRange('bytes=0-99', 1000), { start: 0, end: 99 })
  assert.deepEqual(parseRange('bytes=500-', 1000), { start: 500, end: 999 })
  assert.deepEqual(parseRange('bytes=-100', 1000), { start: 900, end: 999 })
  assert.deepEqual(parseRange('bytes=0-99999', 1000), { start: 0, end: 999 })
  assert.equal(parseRange('bytes=2000-3000', 1000), null)
  assert.equal(parseRange('items=0-10', 1000), null)
  assert.equal(parseRange(undefined, 1000), null)
})

test('健康检查结构：包含前端探测所需字段', async () => {
  const h = await tts.health()
  for (const k of ['ok', 'enabled', 'configured', 'library', 'voices', 'maxTextLength']) {
    assert.ok(k in h, `缺少字段 ${k}`)
  }
  assert.equal(typeof h.voices.male, 'string')
})

test('binary 响应：无 Range → 200 全量；带 Range → 206 分片', async () => {
  const { binary } = await import('../server/http-util.mjs')
  function mockRes() {
    const r = { status: 0, headers: null, body: null }
    r.writeHead = (s, h) => {
      r.status = s
      r.headers = h
    }
    r.end = (b) => {
      r.body = b
    }
    return r
  }
  const buf = Buffer.from('0123456789')

  const full = mockRes()
  binary(full, 200, buf, 'audio/mpeg', { 'Cache-Control': 'public, max-age=31536000, immutable' }, null)
  assert.equal(full.status, 200)
  assert.equal(full.headers['Content-Type'], 'audio/mpeg')
  assert.equal(full.headers['Content-Length'], 10)
  assert.equal(full.headers['Accept-Ranges'], 'bytes')
  assert.equal(full.body.toString(), '0123456789')

  const part = mockRes()
  binary(part, 200, buf, 'audio/mpeg', {}, { headers: { range: 'bytes=2-5' } })
  assert.equal(part.status, 206)
  assert.equal(part.headers['Content-Range'], 'bytes 2-5/10')
  assert.equal(part.body.toString(), '2345')
})
