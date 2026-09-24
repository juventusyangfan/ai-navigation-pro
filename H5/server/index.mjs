// 最小后端，只做两件事（本文件只装配路由，业务在 soe.mjs / tts.mjs）：
//
// 1) 下发智聆口语评测凭证（/api/soe/*）—— 口语评测音频由浏览器经官方 SDK 直连
//    腾讯云 WSS，服务端不转发音频、不参与评测。
// 2) 服务端语音合成听力音频（/api/tts/*）—— 移动端浏览器 speechSynthesis 不可靠，
//    改由服务端调用腾讯云 TTS 出音频，浏览器只做原生 <audio> 播放。
//
// 安全红线：SecretKey 只存在于服务端 .env；生产默认下发 STS 临时密钥。

import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { json, binary, readJsonBody, clientIp, loadDotEnv, handleError, corsHeaders } from './http-util.mjs'
import * as soe from './soe.mjs'
import * as tts from './tts.mjs'

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

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
  try {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, corsHeaders())
      return res.end()
    }

    // —— 智聆评测凭证 ——
    if (url.pathname === '/api/soe/health') return json(res, 200, soe.health())
    if (url.pathname === '/api/soe/credential') return json(res, 200, await soe.credential())

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
