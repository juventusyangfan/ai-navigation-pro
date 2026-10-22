// 家长机识别码 + 测评次数额度（服务端唯一的持久化层）
//
// 为什么要放在服务端：
//   智聆评测是按调用计费的。如果次数只记在 localStorage，家长清一下缓存就重来，
//   等于完全没有限制；学校机房统一装浏览器、无痕窗口更是天然绕过。
//   所以「今天测了几次」必须由服务端记账，前端只负责显示。
//
// 三个概念：
//   设备（device）  —— 浏览器 Cookie 里的随机串 h5_uid（与真实身份无关）
//   识别码（code）  —— 给设备配一个 6 位可读码，家长念给老师、老师在后台按码搜
//   票据（ticket）  —— 开始测评时签发，凭票才能取智聆密钥；没票就拿不到密钥
//
// 为什么用票据而不是每次凭 Cookie 判断：
//   一次测评要取 4 次以上密钥（每道口语题一次，重录还要再取）。
//   如果在取密钥时扣次数，扣的是「题」不是「测评」，额度语义就错了。
//   所以扣减只发生在「开始测评」那一下，之后的取密钥凭票放行。
//
// 存储：server/.data/quota.json（JSON 文件 + 原子替换），量级只有几百个设备，
// 不需要上数据库。Node 单线程 + 同步写入，本身没有并发写竞争。

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const DEVICE_COOKIE = 'h5_uid'
export const CODE_LEN = 6
// 去掉 0 O 1 I L —— 电话或语音里这几个最容易被听错，念错一位就搜不到
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
const KEEP_DAYS = 7
const TICKET_TTL_MS = 6 * 60 * 60 * 1000 // 一次测评不可能跨 6 小时

/* ------------------------------------------------------------------ *
 * 配置：一律在函数里读 process.env
 *
 * 不能在模块顶层读：ESM 会先执行被 import 的模块，再执行 index.mjs 的
 * loadDotEnv()，顶层读到的永远是 .env 之前的空值。
 * ------------------------------------------------------------------ */

function envInt(name, fallback) {
  const n = Number(process.env[name])
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback
}

/** 单设备每日测评次数（默认档） */
export function dailyLimit() {
  // 默认 2 次：够一次正式测评 + 一次重测，再多就基本是白刷。
  // 想恢复放宽只改 H5_DAILY_LIMIT，不用动代码。
  return envInt('H5_DAILY_LIMIT', 2)
}

/**
 * 全站每日测评总次数（成本硬顶）。
 *
 * 这一道**不因个人被放开而豁免**：开放给几个家长是可控的，
 * 但一旦有人批量换 Cookie 刷，只有总数能兜住账单。
 */
export function totalCap() {
  return envInt('H5_DAILY_TOTAL_CAP', 200)
}

/** 总开关。设为 0 时只记账不拦截（应急用：额度服务出问题时先保可用）。 */
export function enforce() {
  return String(process.env.H5_QUOTA_ENFORCE ?? '1') !== '0'
}

function dataDir() {
  return process.env.H5_DATA_DIR
    ? path.resolve(process.env.H5_DATA_DIR)
    : path.join(__dirname, '.data')
}

/* ------------------------------------------------------------------ *
 * 存储
 * ------------------------------------------------------------------ */

let cache = null
let cacheFile = ''

function storePath() {
  return path.join(dataDir(), 'quota.json')
}

function load() {
  const file = storePath()
  if (cache && cacheFile === file) return cache
  fs.mkdirSync(path.dirname(file), { recursive: true })

  let data = null
  if (fs.existsSync(file)) {
    try {
      data = JSON.parse(fs.readFileSync(file, 'utf8'))
    } catch (e) {
      // 文件写坏时备份后重建：不能因为一个坏 JSON 让全站测评停摆，
      // 但也不能静默覆盖——留一份现场便于事后对账。
      try {
        fs.renameSync(file, `${file}.corrupt-${Date.now()}`)
      } catch (e2) {
        /* ignore */
      }
      console.log(`[quota] 存储文件损坏，已备份并重建：${e.message}`)
    }
  }
  if (!data || typeof data !== 'object') data = { version: 1, devices: {}, days: {} }
  if (!data.devices || typeof data.devices !== 'object') data.devices = {}
  if (!data.days || typeof data.days !== 'object') data.days = {}

  cache = data
  cacheFile = file
  return cache
}

function save() {
  const file = cacheFile || storePath()
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const tmp = `${file}.tmp-${process.pid}`
  fs.writeFileSync(tmp, JSON.stringify(cache))
  // 原子替换：进程被杀在写一半时，正式文件仍是上一份完整数据
  fs.renameSync(tmp, file)
}

/** 北京时间自然日。服务器多为 UTC，不显式 +8 会让「今天」从早上 8 点才算。 */
export function dayKeyCn(now = Date.now()) {
  return new Date(now + 8 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

function pruneDays(st) {
  const keys = Object.keys(st.days).sort()
  while (keys.length > KEEP_DAYS) delete st.days[keys.shift()]
}

/* ------------------------------------------------------------------ *
 * 设备与识别码
 * ------------------------------------------------------------------ */

function newCode() {
  let s = ''
  for (let i = 0; i < CODE_LEN; i += 1) s += ALPHABET[crypto.randomInt(0, ALPHABET.length)]
  return s
}

/** 归一化用户输入：大写，去掉横杠空格等一切非字符集内容。 */
export function normalizeCode(raw) {
  return String(raw || '')
    .toUpperCase()
    .split('')
    .filter((c) => ALPHABET.includes(c))
    .join('')
}

/** 展示格式 ABC-DEF：念的时候分两段更好读。 */
export function formatCode(code) {
  const c = normalizeCode(code)
  return c.length === CODE_LEN ? `${c.slice(0, 3)}-${c.slice(3)}` : c
}

export function newDeviceId() {
  return crypto.randomBytes(16).toString('hex')
}

export function isValidDeviceId(v) {
  return typeof v === 'string' && /^[a-f0-9]{32}$/i.test(v)
}

function ensureDevice(anonId) {
  const st = load()
  const hit = st.devices[anonId]
  if (hit) return hit

  const used = new Set(Object.values(st.devices).map((d) => d.code))
  let code = newCode()
  for (let i = 0; i < 50 && used.has(code); i += 1) code = newCode()

  const dev = {
    code,
    createdAt: Date.now(),
    lastAt: 0,
    note: '',
    limitMode: 'default', // default | custom | unlimited
    customLimit: null,
    total: 0
  }
  st.devices[anonId] = dev
  save()
  return dev
}

/* ------------------------------------------------------------------ *
 * 额度计算
 * ------------------------------------------------------------------ */

export function planFor(dev, used) {
  const mode = dev.limitMode || 'default'
  if (mode === 'unlimited') return { limited: false, limit: null, used, mode }
  const custom = Number(dev.customLimit)
  if (mode === 'custom' && Number.isFinite(custom) && custom > 0) {
    return { limited: true, limit: Math.floor(custom), used, mode }
  }
  return { limited: true, limit: dailyLimit(), used, mode: 'default' }
}

function dayOf(st, key) {
  if (!st.days[key]) st.days[key] = { total: 0, devices: {} }
  if (!st.days[key].devices) st.days[key].devices = {}
  return st.days[key]
}

/** 当前这台设备的额度快照（供前端显示）。 */
export function status(anonId) {
  const st = load()
  const dev = ensureDevice(anonId)
  const day = st.days[dayKeyCn()] || { total: 0, devices: {} }
  const used = day.devices[anonId] || 0
  const p = planFor(dev, used)
  const cap = totalCap()
  return {
    ok: true,
    enforce: enforce(),
    code: formatCode(dev.code),
    codeRaw: dev.code,
    used,
    limit: p.limit,
    unlimited: !p.limited,
    remaining: p.limited ? Math.max(0, p.limit - used) : null,
    limitMode: p.mode,
    note: dev.note || '',
    totalUsed: day.total || 0,
    totalCap: cap,
    totalRemaining: Math.max(0, cap - (day.total || 0))
  }
}

/**
 * 开始一次测评：校验并扣减一次。
 *
 * 返回 ok:false 时前端**必须**停下来给提示，不能继续录题——
 * 否则会变成「能录能评但不给密钥」，家长只会觉得坏了。
 */
export function consume(anonId) {
  const st = load()
  const dev = ensureDevice(anonId)

  // 关闭限制时仍然精确记账（便于观测真实用量），只是不拦
  if (!enforce()) {
    const snap = status(anonId)
    return { ok: true, skipped: true, ticket: signTicket(anonId), ...snap }
  }

  const key = dayKeyCn()
  const day = dayOf(st, key)
  const used = day.devices[anonId] || 0
  const p = planFor(dev, used)

  if (p.limited && used >= p.limit) {
    return {
      ok: false,
      error: 'DEVICE_LIMIT',
      message: `这台设备今天已经测过 ${used} 次（每天 ${p.limit} 次）。明天再来看看孩子的进步吧，想多练几篇可以点下面的二维码加老师。`,
      used,
      limit: p.limit,
      unlimited: false,
      code: formatCode(dev.code),
      totalUsed: day.total || 0,
      totalCap: totalCap()
    }
  }

  const cap = totalCap()
  if ((day.total || 0) >= cap) {
    return {
      ok: false,
      error: 'GLOBAL_CAP',
      message: '今天的测评名额已经用完啦，明天再来吧。想问孩子的情况，可以点下面的二维码加老师。',
      used,
      limit: p.limit,
      unlimited: !p.limited,
      code: formatCode(dev.code),
      totalUsed: day.total || 0,
      totalCap: cap
    }
  }

  day.devices[anonId] = used + 1
  day.total = (day.total || 0) + 1
  dev.total = (dev.total || 0) + 1
  dev.lastAt = Date.now()
  pruneDays(st)
  save()

  const nowUsed = used + 1
  return {
    ok: true,
    ticket: signTicket(anonId),
    code: formatCode(dev.code),
    codeRaw: dev.code,
    used: nowUsed,
    limit: p.limit,
    unlimited: !p.limited,
    remaining: p.limited ? Math.max(0, p.limit - nowUsed) : null,
    limitMode: p.mode,
    totalUsed: day.total,
    totalCap: cap,
    totalRemaining: Math.max(0, cap - day.total)
  }
}

/* ------------------------------------------------------------------ *
 * 票据
 *
 * 无状态 HMAC：payload(设备 + 过期时间 + 会话号) + 签名。
 * 服务端不需要存票据，重启也不影响已签发的票——否则家长刚好在重启前后
 * 开始测评，就会被莫名踢回去重来（而次数已经扣了）。
 * ------------------------------------------------------------------ */

function secret() {
  const fromEnv = (process.env.H5_QUOTA_SECRET || '').trim()
  if (fromEnv) return fromEnv

  const file = path.join(dataDir(), '.secret')
  try {
    if (fs.existsSync(file)) {
      const s = fs.readFileSync(file, 'utf8').trim()
      if (s) return s
    }
  } catch (e) {
    /* ignore */
  }
  const s = crypto.randomBytes(32).toString('hex')
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, s, { mode: 0o600 })
  } catch (e) {
    /* 写不了就退化为进程内密钥：重启后旧票失效，但功能仍可用 */
  }
  return s
}

function hmac(body) {
  return crypto.createHmac('sha256', secret()).update(body).digest('base64url')
}

function safeEqual(a, b) {
  const ba = Buffer.from(String(a))
  const bb = Buffer.from(String(b))
  if (ba.length !== bb.length) return false
  return crypto.timingSafeEqual(ba, bb)
}

function signTicket(anonId) {
  const exp = Date.now() + TICKET_TTL_MS
  const sid = crypto.randomBytes(9).toString('base64url')
  const body = Buffer.from(`${anonId}.${exp}.${sid}`, 'utf8').toString('base64url')
  return `${body}.${hmac(body)}`
}

export function verifyTicket(ticket) {
  if (!enforce()) return { ok: true, skipped: true }

  const raw = String(ticket || '').trim()
  if (!raw) {
    return {
      ok: false,
      error: 'NO_TICKET',
      message: '缺少测评凭证，请回到首页点「开始测评」重新进入。'
    }
  }
  const cut = raw.lastIndexOf('.')
  if (cut <= 0) return { ok: false, error: 'BAD_TICKET', message: '测评凭证格式不正确，请回首页重新开始。' }

  const body = raw.slice(0, cut)
  const sig = raw.slice(cut + 1)
  if (!safeEqual(sig, hmac(body))) {
    return { ok: false, error: 'BAD_TICKET', message: '测评凭证校验失败，请回首页重新开始。' }
  }

  let payload = ''
  try {
    payload = Buffer.from(body, 'base64url').toString('utf8')
  } catch (e) {
    return { ok: false, error: 'BAD_TICKET', message: '测评凭证解析失败，请回首页重新开始。' }
  }

  const [anonId, expStr, sid] = payload.split('.')
  const exp = Number(expStr)
  if (!isValidDeviceId(anonId) || !Number.isFinite(exp)) {
    return { ok: false, error: 'BAD_TICKET', message: '测评凭证不完整，请回首页重新开始。' }
  }
  if (Date.now() > exp) {
    return {
      ok: false,
      error: 'TICKET_EXPIRED',
      message: '这次测评已超过 6 小时，请回首页重新开始（不计入今天的次数）。'
    }
  }

  const dev = load().devices[anonId]
  return { ok: true, anonId, sid, code: dev ? formatCode(dev.code) : '' }
}

/**
 * 一张票最多能换多少次密钥。
 *
 * 只是防「拿一张票写脚本反复换密钥」的护栏，不是额度本身。
 * 一次测评 4 道口语题 + 重录，正常远低于 40；进程重启后计数归零，
 * 但票本身仍然有效（不会把家长打断）。
 */
const ticketUse = new Map()

export function noteCredential(sid) {
  if (!sid) return true
  const cap = envInt('H5_TICKET_MAX_CREDENTIALS', 40)
  const now = Date.now()
  if (ticketUse.size > 2000) {
    for (const [k, v] of ticketUse) if (now - v.at > 3600_000) ticketUse.delete(k)
  }
  const cur = ticketUse.get(sid) || { n: 0, at: now }
  cur.n += 1
  cur.at = now
  ticketUse.set(sid, cur)
  return cur.n <= cap
}

/* ------------------------------------------------------------------ *
 * 内部接口（服务端到服务端）：列表与改额度
 * ------------------------------------------------------------------ */

function shape(anonId, dev, day) {
  const used = (day.devices && day.devices[anonId]) || 0
  const p = planFor(dev, used)
  return {
    code: formatCode(dev.code),
    codeRaw: dev.code,
    note: dev.note || '',
    limitMode: p.mode,
    customLimit: dev.customLimit ?? null,
    limit: p.limit,
    unlimited: !p.limited,
    today: used,
    total: dev.total || 0,
    createdAt: dev.createdAt || 0,
    lastAt: dev.lastAt || 0
  }
}

export function listDevices({ q = '', page = 1, pageSize = 20 } = {}) {
  const st = load()
  const day = st.days[dayKeyCn()] || { total: 0, devices: {} }
  const kw = normalizeCode(q)

  let items = Object.entries(st.devices).map(([anonId, dev]) => shape(anonId, dev, day))
  if (kw) items = items.filter((i) => i.codeRaw.includes(kw))
  // 最近用过的排前面：老板多半是在家长刚发来识别码时来查的
  items.sort((a, b) => (b.lastAt || b.createdAt) - (a.lastAt || a.createdAt))

  const size = Math.min(100, Math.max(1, Number(pageSize) || 20))
  const p = Math.max(1, Number(page) || 1)
  return {
    ok: true,
    total: items.length,
    page: p,
    pageSize: size,
    items: items.slice((p - 1) * size, p * size),
    defaults: { dailyLimit: dailyLimit(), totalCap: totalCap(), enforce: enforce() },
    today: { total: day.total || 0, distinctDevices: Object.keys(day.devices || {}).length }
  }
}

export function updateDevice(code, patch = {}) {
  const st = load()
  const want = normalizeCode(code)
  const hit = Object.entries(st.devices).find(([, d]) => d.code === want)
  if (!hit) return { ok: false, error: 'NOT_FOUND', message: '没有这个识别码，请让家长核对后重试' }

  const [anonId, dev] = hit
  const next = { ...dev }

  if (patch.note !== undefined) next.note = String(patch.note || '').slice(0, 40)

  if (patch.limitMode !== undefined) {
    if (!['default', 'custom', 'unlimited'].includes(patch.limitMode)) {
      return { ok: false, error: 'BAD_MODE', message: 'limitMode 只能是 default / custom / unlimited' }
    }
    next.limitMode = patch.limitMode
  }

  if (patch.customLimit !== undefined) {
    if (patch.customLimit === null || patch.customLimit === '') {
      next.customLimit = null
    } else {
      const n = Number(patch.customLimit)
      if (!Number.isInteger(n) || n < 1 || n > 200) {
        return { ok: false, error: 'BAD_LIMIT', message: 'customLimit 需为 1—200 的整数（清空表示沿用默认值）' }
      }
      next.customLimit = n
    }
  }

  next.updatedAt = Date.now()
  st.devices[anonId] = next
  save()

  const day = st.days[dayKeyCn()] || { total: 0, devices: {} }
  return { ok: true, device: shape(anonId, next, day), defaults: { dailyLimit: dailyLimit(), totalCap: totalCap() } }
}
