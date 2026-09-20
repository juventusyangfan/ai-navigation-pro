// 腾讯云语音合成（TTS）· 服务端封装
//
// 为什么放在服务端：移动端浏览器（微信 X5 / WKWebView 等）的 speechSynthesis 支持残缺，
// 且失败几乎是静默的（既不回调 onend 也不回调 onerror），无法作为听力音频的可靠来源。
// 改为服务端调用腾讯云 TTS 合成音频、浏览器只做原生 <audio> 播放 ——
// 与播放真人录音走的是同一条最可靠路径，彻底摆脱浏览器语音合成能力。
//
// 官方接口（已在 README「8. 题目音频：服务端腾讯云语音合成」核实）：
//   请求域名 tts.tencentcloudapi.com   Action=TextToVoice   Version=2019-08-23
//   Text：英文 ≤500 字母、中文 ≤150 汉字（本仓库题目最长 415 字符，单段足够）
//   返回：Audio（base64 编码的音频）、SessionId、RequestId
//   默认并发：大模型音色 20 并发 / 精品音色 20 并发
//
// 角色分声：题目 audioText 用 "Boy:" / "Woman:" 等前缀标注说话人。
//   腾讯云「英文专用」音色只有男 / 女两档，故按性别归并；听力对话拆成多段、
//   分别合成后拼接为一个 mp3，避免「一人分饰两角」误导学生。

import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// 角色 → 音色槽位（英文音色无童声，Boy/Girl 与 Man/Woman 只能按性别区分）
const ROLE_RE = /(Boy|Girl|Man|Woman|Narrator)\s*:\s*/g
const ROLE_SLOT = { boy: 'male', man: 'male', girl: 'female', woman: 'female', narrator: 'narrator' }

// 默认音色（大模型音色，支持 24k 采样率，价格低于超自然大模型音色）
const DEFAULT_VOICES = {
  male: '501008', // WeJames 英文男声
  female: '501009', // WeWinny 英文女声
  narrator: '501009'
}

const SCHEMA = 'tts-v1' // 缓存结构版本，参数口径变更时递增
const MAX_TEXT_LENGTH = 500 // 单次合成上限（英文 500 字母）
const MAX_SEGMENT_LENGTH = 480 // 单段保护阈值，超长自动按句再切

function env(name, fallback) {
  const v = process.env[name]
  return v === undefined || v === '' ? fallback : v
}

export function getConfig() {
  // TTS 与智聆共用同一对腾讯云密钥；也允许用 TTS_SECRET_ID/KEY 单独指定
  const secretId = env('TTS_SECRET_ID', process.env.SOE_SECRET_ID || '')
  const secretKey = env('TTS_SECRET_KEY', process.env.SOE_SECRET_KEY || '')
  return {
    enabled: env('TTS_ENABLED', '1') !== '0',
    secretId,
    secretKey,
    configured: !!(secretId && secretKey),
    voices: {
      male: env('TTS_VOICE_MALE', DEFAULT_VOICES.male),
      female: env('TTS_VOICE_FEMALE', DEFAULT_VOICES.female),
      narrator: env('TTS_VOICE_NARRATOR', DEFAULT_VOICES.narrator)
    },
    speed: Number(env('TTS_SPEED', '0')), // 0 = 1.0 倍速；范围 [-2, 6]
    sampleRate: Number(env('TTS_SAMPLE_RATE', '0')), // 0 = 按音色自动（24k / 16k）
    cacheDir: path.resolve(__dirname, env('TTS_CACHE_DIR', '.cache/tts')),
    cacheMaxBytes: Number(env('TTS_CACHE_MAX_MB', '64')) * 1024 * 1024,
    // 安全默认：只允许合成题库内的文本，避免接口被拿来刷配额
    allowAnyText: env('TTS_ALLOW_ANY_TEXT', '0') === '1',
    maxConcurrency: Number(env('TTS_MAX_CONCURRENCY', '4'))
  }
}

export function isConfigured(cfg = getConfig()) {
  return cfg.enabled && cfg.configured
}

// ── 文本归一化 / 校验 ────────────────────────────────────────────────────────
export function normalizeText(text) {
  return String(text || '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim()
}

function assertText(text, cfg) {
  if (!text) throw httpError(400, 'TTS_TEXT_EMPTY', '合成文本为空')
  if (text.length > MAX_TEXT_LENGTH) {
    throw httpError(400, 'TTS_TEXT_TOO_LONG', `文本长度 ${text.length} 超出上限 ${MAX_TEXT_LENGTH}`)
  }
  if (!/[\u4e00-\u9fa5]|[A-Za-z]/.test(text)) {
    throw httpError(400, 'TTS_TEXT_INVALID', '文本不含可合成字符')
  }
  if (!cfg.allowAnyText) {
    // 白名单模式：只允许题库里实际存在的文本（防止公开接口被刷配额）
    return loadPaperTexts().then((set) => {
      if (!set.has(normalizeText(text))) {
        throw httpError(403, 'TTS_TEXT_NOT_ALLOWED', '该文本不在题库白名单内（如需合成任意文本请设置 TTS_ALLOW_ANY_TEXT=1）')
      }
    })
  }
  return Promise.resolve()
}

let paperTextsPromise = null
function loadPaperTexts() {
  if (!paperTextsPromise) {
    paperTextsPromise = (async () => {
      const mod = await import('../src/data/paper.js')
      const set = new Set()
      for (const paper of Object.values(mod.papers)) {
        for (const section of paper.sections) {
          for (const item of section.items) {
            if (item.audioText) set.add(normalizeText(item.audioText))
          }
        }
      }
      return set
    })()
  }
  return paperTextsPromise
}

export function httpError(status, code, message) {
  const e = new Error(message)
  e.status = status
  e.code = code
  return e
}

// ── 分角色切段 ───────────────────────────────────────────────────────────────
export function splitByRole(text) {
  const t = normalizeText(text)
  if (!t) return []
  const marks = []
  ROLE_RE.lastIndex = 0
  let m
  while ((m = ROLE_RE.exec(t)) !== null) {
    marks.push({ slot: ROLE_SLOT[m[1].toLowerCase()] || 'narrator', start: m.index, after: m.index + m[0].length })
  }
  const raw = []
  if (!marks.length) {
    raw.push({ slot: 'narrator', text: t })
  } else {
    const head = t.slice(0, marks[0].start).trim()
    if (head) raw.push({ slot: 'narrator', text: head })
    marks.forEach((mk, i) => {
      const end = i + 1 < marks.length ? marks[i + 1].start : t.length
      const body = t.slice(mk.after, end).trim()
      if (body) raw.push({ slot: mk.slot, text: body })
    })
  }
  // 单段超长时按句再切（保证每次请求都在 Text 长度限制内）
  const out = []
  for (const seg of raw) {
    for (const piece of splitLong(seg.text, MAX_SEGMENT_LENGTH)) out.push({ slot: seg.slot, text: piece })
  }
  return out
}

function splitLong(text, max) {
  if (text.length <= max) return [text]
  const pieces = []
  let buf = ''
  // 按句切分；仍超长再按逗号切
  for (const sentence of text.split(/(?<=[.!?。！？])\s+/)) {
    if ((buf + ' ' + sentence).trim().length > max && buf) {
      pieces.push(buf.trim())
      buf = ''
    }
    if (sentence.length > max) {
      for (const clause of sentence.split(/(?<=[,;，；])\s*/)) {
        if ((buf + ' ' + clause).trim().length > max && buf) {
          pieces.push(buf.trim())
          buf = ''
        }
        buf = (buf ? buf + ' ' : '') + clause
      }
    } else {
      buf = (buf ? buf + ' ' : '') + sentence
    }
  }
  if (buf.trim()) pieces.push(buf.trim())
  return pieces.filter(Boolean)
}

// ── 音色采样率：精品音色（1xxxxx）最高 16k，大模型/超自然音色支持 24k ─────────
function sampleRateFor(voiceType, cfg) {
  if (cfg.sampleRate) return cfg.sampleRate
  return /^1/.test(String(voiceType)) ? 16000 : 24000
}

// ── SDK 客户端（懒加载 + 结构校验） ──────────────────────────────────────────
let clientPromise = null
async function getClient(cfg) {
  if (!clientPromise) {
    clientPromise = (async () => {
      const tc = await import('tencentcloud-sdk-nodejs-tts')
      const tts = tc.tts || (tc.default && tc.default.tts)
      if (!tts || !tts.v20190823 || !tts.v20190823.Client) {
        throw httpError(500, 'TTS_SDK_MISSING', '未找到 tts.v20190823.Client，请安装依赖 tencentcloud-sdk-nodejs-tts')
      }
      return new tts.v20190823.Client({
        credential: { secretId: cfg.secretId, secretKey: cfg.secretKey },
        region: 'ap-guangzhou',
        profile: { httpProfile: { endpoint: 'tts.tencentcloudapi.com', reqTimeout: 20 } }
      })
    })()
  }
  return clientPromise
}

// 上游错误 → 可读的排障指引（杨总排查生产问题最需要这一段）
export function describeUpstreamError(e) {
  const code = (e && e.code) || ''
  const raw = (e && e.message) || String(e)
  const tips = {
    'UnsupportedOperation.ServerNotOpen': '语音合成服务尚未开通，请到控制台 https://console.cloud.tencent.com/tts 开通',
    'UnsupportedOperation.NoFreeAccount': '免费额度已用尽，请购买资源包或开通后付费',
    'UnsupportedOperation.PkgExhausted': '资源包余量已用尽',
    'UnsupportedOperation.AccountArrears': '账号欠费，语音合成已停用',
    'LimitExceeded.AccessLimit': '请求超过并发/频率限制，请稍后重试',
    'InvalidParameterValue.VoiceType': 'VoiceType 音色 ID 非法，请核对 TTS_VOICE_* 配置',
    'InvalidParameterValue.SampleRate': 'SampleRate 非法：精品音色最高 16k，大模型音色支持 24k',
    'UnsupportedOperation.AuthorizationFailed': '鉴权失败：请核对密钥与语音合成的 CAM 授权',
    'AuthFailure.InvalidAuthorization': '授权无效：请核对 TTS_SECRET_ID / TTS_SECRET_KEY'
  }
  return tips[code] || raw
}

// ── 单段合成 ─────────────────────────────────────────────────────────────────
async function synthSegment(client, cfg, seg) {
  const voiceType = cfg.voices[seg.slot] || cfg.voices.narrator
  const params = {
    Text: seg.text,
    SessionId: crypto.randomUUID(),
    ModelType: 1,
    VoiceType: Number(voiceType),
    PrimaryLanguage: /[\u4e00-\u9fa5]/.test(seg.text) ? 1 : 2, // 2 = 英文
    SampleRate: sampleRateFor(voiceType, cfg),
    Codec: 'mp3',
    Speed: cfg.speed
  }
  let r
  try {
    r = await client.TextToVoice(params)
  } catch (e) {
    throw httpError(502, 'TTS_UPSTREAM_FAILED', describeUpstreamError(e))
  }
  if (!r || !r.Audio) throw httpError(502, 'TTS_EMPTY_AUDIO', '上游未返回音频数据')
  return { buf: Buffer.from(r.Audio, 'base64'), requestId: r.RequestId || '', voiceType: String(voiceType) }
}

// ── mp3 拼接：剥离除首段外的 ID3 头，避免中间出现非音频数据 ──────────────────
function stripId3(buf) {
  if (buf.length > 10 && buf.toString('latin1', 0, 3) === 'ID3') {
    const size =
      ((buf[6] & 0x7f) << 21) | ((buf[7] & 0x7f) << 14) | ((buf[8] & 0x7f) << 7) | (buf[9] & 0x7f)
    const end = 10 + size
    if (end < buf.length) return buf.subarray(end)
  }
  return buf
}

export function concatMp3(buffers) {
  if (buffers.length <= 1) return buffers[0] || Buffer.alloc(0)
  // 全部剥离：ID3 只承载元信息，对播放无价值，去掉可确保帧流连续
  return Buffer.concat(buffers.map(stripId3))
}

// ── 缓存 ─────────────────────────────────────────────────────────────────────
function cacheKey(text, cfg) {
  const voices = [cfg.voices.male, cfg.voices.female, cfg.voices.narrator].join(',')
  return crypto.createHash('sha1').update([SCHEMA, voices, cfg.speed, cfg.sampleRate, text].join('|')).digest('hex')
}

async function readCache(cfg, key) {
  try {
    const buf = await fsp.readFile(path.join(cfg.cacheDir, key + '.mp3'))
    return buf
  } catch (e) {
    return null
  }
}

async function writeCache(cfg, key, buf, meta) {
  try {
    await fsp.mkdir(cfg.cacheDir, { recursive: true })
    await fsp.writeFile(path.join(cfg.cacheDir, key + '.mp3'), buf)
    await fsp.writeFile(
      path.join(cfg.cacheDir, key + '.json'),
      JSON.stringify({ ...meta, bytes: buf.length, createdAt: new Date().toISOString() }, null, 2),
      'utf8'
    )
    await pruneCache(cfg)
  } catch (e) {
    /* 缓存失败不影响主流程 */
  }
}

// 缓存目录超上限时，按最近修改时间淘汰到 80%
async function pruneCache(cfg) {
  try {
    const names = (await fsp.readdir(cfg.cacheDir)).filter((n) => n.endsWith('.mp3'))
    const stats = await Promise.all(
      names.map(async (n) => ({ n, ...(await fsp.stat(path.join(cfg.cacheDir, n))) }))
    )
    let total = stats.reduce((s, x) => s + x.size, 0)
    if (total <= cfg.cacheMaxBytes) return
    stats.sort((a, b) => a.mtimeMs - b.mtimeMs)
    const target = cfg.cacheMaxBytes * 0.8
    for (const s of stats) {
      if (total <= target) break
      await fsp.rm(path.join(cfg.cacheDir, s.n), { force: true })
      await fsp.rm(path.join(cfg.cacheDir, s.n.replace(/\.mp3$/, '.json')), { force: true })
      total -= s.size
    }
  } catch (e) {
    /* ignore */
  }
}

// ── 并发闸门：避免本进程把上游并发打满 ──────────────────────────────────────
let running = 0
const queue = []
function acquire(cfg) {
  if (running < cfg.maxConcurrency) {
    running += 1
    return Promise.resolve()
  }
  return new Promise((resolve) => queue.push(resolve))
}
function release() {
  const next = queue.shift()
  if (next) next()
  else running = Math.max(0, running - 1)
}

/**
 * 合成一段题目音频。
 * @param {string} text 题目文本（可含 "Boy:" / "Woman:" 角色前缀）
 * @param {{voice?:string, speed?:number}} opts voice: auto | male | female | 具体音色 ID
 * @returns {Promise<{buffer:Buffer, key:string, cached:boolean, segments:number, voices:string[], requestIds:string[]}>}
 */
export async function synthesize(text, opts = {}) {
  const cfg = getConfig()
  if (!cfg.enabled) throw httpError(503, 'TTS_DISABLED', '服务端已关闭语音合成（TTS_ENABLED=0）')
  if (!cfg.configured) {
    throw httpError(503, 'TTS_NOT_CONFIGURED', '服务端未配置 TTS 密钥：请设置 TTS_SECRET_ID / TTS_SECRET_KEY（或复用 SOE_SECRET_ID / SOE_SECRET_KEY）')
  }

  const normalized = normalizeText(text)
  await assertText(normalized, cfg)

  // 指定单一音色时只合成一段（不分角色）
  let segments
  if (opts.voice && opts.voice !== 'auto') {
    const slot = ROLE_SLOT[opts.voice] || opts.voice
    const voiceType = cfg.voices[slot] || slot
    segments = splitLong(normalized, MAX_SEGMENT_LENGTH).map((t) => ({ slot: null, text: t, forcedVoice: String(voiceType) }))
  } else {
    segments = splitByRole(normalized)
  }
  if (!segments.length) throw httpError(400, 'TTS_TEXT_EMPTY', '切段后无有效文本')

  const keyCfg = { ...cfg }
  if (opts.voice && opts.voice !== 'auto') keyCfg.voices = { male: opts.voice, female: opts.voice, narrator: opts.voice }
  const keyText = normalized + (opts.voice && opts.voice !== 'auto' ? '|v=' + opts.voice : '')
  const key = cacheKey(keyText, keyCfg)

  const hit = opts.noCache ? null : await readCache(cfg, key)
  if (hit && hit.length > 0) {
    return { buffer: hit, key, cached: true, segments: segments.length, voices: [], requestIds: [] }
  }

  await acquire(cfg)
  try {
    const client = await getClient(cfg)
    const parts = []
    const requestIds = []
    const voices = []
    for (const seg of segments) {
      const target = seg.forcedVoice ? { ...seg, slot: null, forcedVoice: seg.forcedVoice } : seg
      const one = target.forcedVoice
        ? await synthSegment(client, { ...cfg, voices: { male: target.forcedVoice, female: target.forcedVoice, narrator: target.forcedVoice } }, target)
        : await synthSegment(client, cfg, target)
      parts.push(one.buf)
      requestIds.push(one.requestId)
      voices.push(one.voiceType)
    }
    const buffer = concatMp3(parts)
    if (!buffer.length) throw httpError(502, 'TTS_EMPTY_AUDIO', '合成结果为空')
    await writeCache(cfg, key, buffer, { key, voices, segments: segments.length, speed: cfg.speed })
    return { buffer, key, cached: false, segments: segments.length, voices, requestIds }
  } finally {
    release()
  }
}

/**
 * 云端合成探针：拿题库里最短的一条真合成一次，确认「语音合成是否已在控制台开通」。
 * 开通状态无法从配置推断（UnsupportedOperation.ServerNotOpen 只在真调用时才出现），
 * 故做一次真实调用；若命中缓存说明此前已成功合成过，不会重复计费。
 */
export async function probe() {
  const cfg = getConfig()
  if (!isConfigured(cfg)) return { ok: false, reason: 'NOT_CONFIGURED', message: '未配置 TTS 密钥' }
  try {
    const texts = await loadPaperTexts()
    const sample = [...texts].sort((a, b) => a.length - b.length)[0]
    if (!sample) return { ok: false, reason: 'NO_SAMPLE', message: '题库中没有可合成的文本' }
    const r = await synthesize(sample)
    return { ok: true, cached: r.cached, segments: r.segments, bytes: r.buffer.length, sample: sample.slice(0, 40) }
  } catch (e) {
    return { ok: false, reason: e.code || 'ERROR', message: e.message }
  }
}

/** 健康检查：供前端探测服务端合成能力，未就绪时提前降级而不是等播放失败 */
export async function health() {
  const cfg = getConfig()
  let libraryOk = true
  try {
    await import('tencentcloud-sdk-nodejs-tts')
  } catch (e) {
    libraryOk = false
  }
  return {
    ok: isConfigured(cfg) && libraryOk,
    enabled: cfg.enabled,
    configured: cfg.configured,
    library: libraryOk,
    voices: cfg.voices,
    speed: cfg.speed,
    sampleRate: cfg.sampleRate || 'auto',
    allowAnyText: cfg.allowAnyText,
    maxTextLength: MAX_TEXT_LENGTH
  }
}

export const internals = { splitByRole, splitLong, concatMp3, stripId3, sampleRateFor, cacheKey, MAX_TEXT_LENGTH }
