// 最小后端，只做四件事（本文件只装配路由，业务在 soe.mjs / tts.mjs / quota.mjs）：
//
// 1) 下发智聆口语评测凭证（/api/soe/*）—— 口语评测音频由浏览器经官方 SDK 直连
//    腾讯云 WSS，服务端不转发音频、不参与评测。
// 2) 服务端语音合成听力音频（/api/tts/*）—— 移动端浏览器 speechSynthesis 不可靠，
//    改由服务端调用腾讯云 TTS 出音频，浏览器只做原生 <audio> 播放。
// 3) 家长机识别码与测评次数额度（/api/quota*）—— 智聆按次计费，必须服务端记账，
//    否则清缓存即绕过。开始测评时扣一次并签票，取密钥凭票放行。
// 4) 内部接口（/api/internal/*）—— 供老板按识别码人工放开某个家长，需 token。
//
// 安全红线：SecretKey 只存在于服务端 .env；生产默认下发 STS 临时密钥。

import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { json, binary, readJsonBody, clientIp, loadDotEnv, handleError, corsHeaders } from './http-util.mjs'
import * as soe from './soe.mjs'
import * as tts from './tts.mjs'
import * as quota from './quota.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
loadDotEnv(path.join(__dirname, '.env'))

const PORT = Number(process.env.PORT || 8787)

// 轻量限流：合成会消耗云端配额，公开接口必须防刷
const RATE_WINDOW_MS = 60_000
const RATE_MAX = Number(process.env.TTS_RATE_PER_MIN || '120')
const buckets = new Map()

function rateLimited(ip) {
  const now = Date.now()
  let b = buckets.get(ip)
  if (!b || now - b.start >= RATE_WINDOW_MS) {
    b = { start: now, count: 0 }
    buckets.set(ip, b)
  }
  b.count += 1
  if (buckets.size > 5000) buckets.clear() // 极端情况防内存膨胀
  return b.count > RATE_MAX
}

async function handleTtsAudio(req, res, url) {
  const ip = clientIp(req)
  if (rateLimited(ip)) {
    return json(res, 429, {
      error: 'TTS_RATE_LIMITED',
      message: `请求过于频繁（单 IP 每分钟上限 ${RATE_MAX} 次），请稍后重试`
    })
  }

  let text = url.searchParams.get('text') || ''
  let voice = url.searchParams.get('voice') || 'auto'
  if (req.method === 'POST') {
    const body = await readJsonBody(req)
    if (body.text) text = body.text
    if (body.voice) voice = body.voice
  }

  const r = await tts.synthesize(text, { voice })
  return binary(
    res,
    200,
    r.buffer,
    'audio/mpeg',
    {
      // 同一文本合成结果恒定，可长期缓存（浏览器/CDN 命中即不再消耗配额）
      'Cache-Control': 'public, max-age=31536000, immutable',
      ETag: `"${r.key}"`,
      'X-TTS-Cache': r.cached ? 'hit' : 'miss',
      'X-TTS-Segments': String(r.segments),
      'X-TTS-Voices': r.voices.join(',')
    },
    req
  )
}

/* ------------------------------------------------------------------ *
 * 家长机识别码与测评次数
 * ------------------------------------------------------------------ */

/** 从 Cookie 头里读一个值（不引第三方 cookie 解析库）。 */
function readCookie(req, name) {
  const raw = req.headers.cookie || ''
  for (const part of String(raw).split(';')) {
    const at = part.indexOf('=')
    if (at < 0) continue
    if (part.slice(0, at).trim() !== name) continue
    return decodeURIComponent(part.slice(at + 1).trim())
  }
  return ''
}

/**
 * 取本次请求的设备 ID；没有就发一个新的。
 * 只有拿到新 ID 时才需要下发 Set-Cookie（避免每个请求都带着重复的 Cookie 头）。
 */
function deviceOf(req) {
  const existing = readCookie(req, quota.DEVICE_COOKIE)
  if (quota.isValidDeviceId(existing)) return { anonId: existing, fresh: false }
  return { anonId: quota.newDeviceId(), fresh: true }
}

function deviceCookie(anonId, req) {
  const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim()
  const secure = proto === 'https' || process.env.H5_COOKIE_SECURE === '1'
  const maxAge = 180 * 24 * 3600
  // HttpOnly：前端拿不到也无所谓（识别码由 /api/quota 返回），
  // 但脚本也偷不走——这是匿名身份，不该给页面留任何操作入口。
  return `${quota.DEVICE_COOKIE}=${anonId}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`
}

function handleQuotaStatus(req, res) {
  const { anonId, fresh } = deviceOf(req)
  try {
    const snap = quota.status(anonId)
    return json(res, 200, snap, fresh ? { 'Set-Cookie': deviceCookie(anonId, req) } : {})
  } catch (e) {
    // 额度服务出问题不能连带把测评入口打死：告诉前端「未启用限制」，页面照常可用
    console.log(`[quota] status 失败：${e.message}`)
    return json(res, 200, { ok: false, enforce: false, error: 'QUOTA_UNAVAILABLE', message: '额度服务暂时不可用' })
  }
}

function handleQuotaStart(req, res) {
  const { anonId, fresh } = deviceOf(req)
  const extra = fresh ? { 'Set-Cookie': deviceCookie(anonId, req) } : {}
  try {
    const r = quota.consume(anonId)
    if (!r.ok) {
      const status = r.error === 'GLOBAL_CAP' ? 503 : 429
      return json(res, status, r, extra)
    }
    return json(res, 200, r, extra)
  } catch (e) {
    // fail-open：记账失败时放行。丢掉一次计数，好过让所有家长都测不了。
    console.log(`[quota] start 失败，本次放行：${e.message}`)
    return json(res, 200, { ok: true, degraded: true, enforce: false, message: '额度服务暂时不可用，本次直接放行' }, extra)
  }
}

/* ---- 内部接口：老板按识别码人工放开额度 ---- */

function internalAuth(req) {
  const expect = (process.env.H5_INTERNAL_TOKEN || '').trim()
  if (!expect) return { ok: false, message: '内部接口未启用（服务端未配置 H5_INTERNAL_TOKEN）' }
  const got = String(req.headers['x-cron-token'] || '').trim()
  if (got.length !== expect.length) return { ok: false, message: '无权访问' }
  // 恒定时间比较：`!==` 会按首个不同字符提前返回，理论上可被逐字节试探
  let diff = 0
  for (let i = 0; i < expect.length; i += 1) diff |= got.charCodeAt(i) ^ expect.charCodeAt(i)
  return diff === 0 ? { ok: true } : { ok: false, message: '无权访问' }
}

async function handleInternalDevices(req, res, url) {
  const auth = internalAuth(req)
  if (!auth.ok) return json(res, 401, { error: 'UNAUTHORIZED', message: auth.message })

  // /api/internal/quota/devices            GET  列表 / 按码搜索
  // /api/internal/quota/devices/<CODE>     PATCH 改额度
  const m = /^\/api\/internal\/quota\/devices(?:\/([^/]+))?\/?$/.exec(url.pathname)
  if (!m) return json(res, 404, { error: 'NOT_FOUND', message: '未知接口' })
  const code = m[1] ? decodeURIComponent(m[1]) : ''

  if (!code) {
    if (req.method !== 'GET') return json(res, 405, { error: 'METHOD_NOT_ALLOWED', message: '列表接口仅支持 GET' })
    return json(
      res,
      200,
      quota.listDevices({
        q: url.searchParams.get('q') || '',
        page: url.searchParams.get('page') || 1,
        pageSize: url.searchParams.get('pageSize') || 20
      })
    )
  }

  if (req.method !== 'PATCH' && req.method !== 'POST') {
    return json(res, 405, { error: 'METHOD_NOT_ALLOWED', message: '单条接口仅支持 PATCH' })
  }
  const body = await readJsonBody(req)
  // 显式只取这三个字段：避免把 code / total 之类的内部字段从前端写进来
  const patch = {}
  if (body.note !== undefined) patch.note = body.note
  if (body.limitMode !== undefined) patch.limitMode = body.limitMode
  if (body.customLimit !== undefined) patch.customLimit = body.customLimit

  const r = quota.updateDevice(code, patch)
  return json(res, r.ok ? 200 : r.error === 'NOT_FOUND' ? 404 : 400, r)
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
  try {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, corsHeaders())
      return res.end()
    }

    // —— 智聆评测凭证 ——
    if (url.pathname === '/api/soe/health') return json(res, 200, soe.health())
    if (url.pathname === '/api/soe/credential') {
      // 凭票取密钥：票只在「开始测评」时签发（那次已经扣过次数）。
      // 没有票就不发密钥——否则绕开首页直接调本接口就能无限评测，额度形同虚设。
      const gate = quota.verifyTicket(req.headers['x-quota-ticket'])
      if (!gate.ok) {
        return json(res, 401, { error: gate.error, message: gate.message })
      }
      if (!quota.noteCredential(gate.sid)) {
        return json(res, 429, {
          error: 'TICKET_EXHAUSTED',
          message: '本次测评换取的密钥次数已达上限，请回首页重新开始一次测评。'
        })
      }
      const cred = await soe.credential()
      if (gate.code) cred.deviceCode = gate.code
      return json(res, 200, cred)
    }

    // —— 家长机识别码与测评次数 ——
    if (url.pathname === '/api/quota') {
      if (req.method !== 'GET') return json(res, 405, { error: 'METHOD_NOT_ALLOWED', message: '/api/quota 仅支持 GET' })
      return handleQuotaStatus(req, res)
    }
    if (url.pathname === '/api/quota/start') {
      if (req.method !== 'POST') {
        return json(res, 405, { error: 'METHOD_NOT_ALLOWED', message: '/api/quota/start 仅支持 POST' })
      }
      return handleQuotaStart(req, res)
    }

    // —— 内部接口（需 x-cron-token） ——
    if (url.pathname.startsWith('/api/internal/quota/devices')) {
      return await handleInternalDevices(req, res, url)
    }

    // —— 服务端语音合成 ——
    if (url.pathname === '/api/tts/health') {
      const h = await tts.health()
      // ?probe=1 额外做一次真实合成，用于确认云端「语音合成已开通」（开通后自检用）
      if (url.searchParams.get('probe') === '1') h.probe = await tts.probe()
      return json(res, 200, h)
    }
    if (url.pathname === '/api/tts/audio') {
      if (req.method !== 'GET' && req.method !== 'POST') {
        return json(res, 405, { error: 'METHOD_NOT_ALLOWED', message: '/api/tts/audio 仅支持 GET / POST' })
      }
      return await handleTtsAudio(req, res, url)
    }

    return json(res, 404, { error: 'NOT_FOUND', message: `未知接口 ${url.pathname}` })
  } catch (e) {
    return handleError(res, e)
  }
})

server.listen(PORT, () => {
  const soeCfg = soe.health()
  console.log(`[h5-api] http://127.0.0.1:${PORT}`)
  console.log(
    `[quota] enforce=${quota.enforce()} dailyLimit=${quota.dailyLimit()} totalCap=${quota.totalCap()}`
  )
  if (!quota.enforce()) console.log('[quota] 警告：H5_QUOTA_ENFORCE=0，次数限制已关闭（仅记录不拦截）')
  if (!(process.env.H5_INTERNAL_TOKEN || '').trim()) {
    console.log('[quota] 未配置 H5_INTERNAL_TOKEN，内部设备管理接口不可用')
  }
  console.log(`[soe] configured=${soeCfg.configured} mode=${soeCfg.mode}`)
  if (!soeCfg.configured) console.log('[soe] 未配置密钥，请先填写 server/.env')
  if (soeCfg.mode === 'static') console.log('[soe] 警告：正在下发永久密钥（SOE_ALLOW_STATIC=1），仅限本地调试！')
  tts
    .health()
    .then(async (h) => {
      console.log(`[tts] configured=${h.configured} library=${h.library} voices=${JSON.stringify(h.voices)}`)
      if (!h.configured) console.log('[tts] 未配置密钥，/api/tts/audio 将返回 503')
      if (!h.library) console.log('[tts] 缺少依赖：npm i tencentcloud-sdk-nodejs-tts')
      if (!h.configured || !h.library) return
      const p = await tts.probeOnce()
      if (p.ok) {
        console.log(`[tts] 合成可用（探针 ${p.bytes} B${p.cached ? '，命中缓存' : ''}）`)
      } else {
        // 这里必须打出原因：否则服务起来一切「正常」，只有点播放才知道是坏的
        console.log(`[tts] 合成不可用 [${p.reason}] ${p.message}`)
        console.log('[tts] 排障：npm run tts:check')
      }
    })
    .catch(() => console.log('[tts] 健康检查失败'))
})

export { server }
