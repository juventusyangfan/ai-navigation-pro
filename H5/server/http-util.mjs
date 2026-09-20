// HTTP 通用工具：响应封装 / 请求体读取 / Range 解析 / .env 加载。
// 只放与业务无关的传输层代码，业务一律下沉到 soe.mjs / tts.mjs。

import fs from 'node:fs'

export function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': process.env.SOE_ALLOW_ORIGIN || '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
  }
}

export function json(res, code, body, extra = {}) {
  const buf = Buffer.from(JSON.stringify(body), 'utf8')
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': buf.length,
    'Cache-Control': 'no-store',
    ...corsHeaders(),
    ...extra
  })
  res.end(buf)
}

/**
 * 二进制响应（音频）。支持简单 Range 请求，<audio> 拖动/预载更稳。
 */
export function binary(res, status, buf, contentType, extra = {}, req = null) {
  const range = req ? parseRange(req.headers.range, buf.length) : null
  if (range) {
    const chunk = buf.subarray(range.start, range.end + 1)
    res.writeHead(206, {
      'Content-Type': contentType,
      'Content-Length': chunk.length,
      'Content-Range': `bytes ${range.start}-${range.end}/${buf.length}`,
      'Accept-Ranges': 'bytes',
      ...corsHeaders(),
      ...extra
    })
    return res.end(chunk)
  }
  res.writeHead(status, {
    'Content-Type': contentType,
    'Content-Length': buf.length,
    'Accept-Ranges': 'bytes',
    ...corsHeaders(),
    ...extra
  })
  res.end(buf)
}

export function parseRange(header, size) {
  if (!header) return null
  const m = /^bytes=(\d*)-(\d*)$/.exec(String(header).trim())
  if (!m) return null
  let start = m[1] === '' ? null : Number(m[1])
  let end = m[2] === '' ? null : Number(m[2])
  if (start === null && end === null) return null
  if (start === null) {
    start = Math.max(0, size - end)
    end = size - 1
  } else if (end === null || end >= size) {
    end = size - 1
  }
  if (start > end || start >= size) return null
  return { start, end }
}

export function readJsonBody(req, limit = 16 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (c) => {
      size += c.length
      if (size > limit) {
        const e = new Error('请求体过大')
        e.status = 413
        e.code = 'BODY_TOO_LARGE'
        reject(e)
        req.destroy()
        return
      }
      chunks.push(c)
    })
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8').trim()
      if (!raw) return resolve({})
      try {
        resolve(JSON.parse(raw))
      } catch (e) {
        const err = new Error('请求体不是合法 JSON')
        err.status = 400
        err.code = 'BAD_JSON'
        reject(err)
      }
    })
    req.on('error', reject)
  })
}

export function clientIp(req) {
  const xff = req.headers['x-forwarded-for']
  if (xff) return String(xff).split(',')[0].trim()
  return (req.socket && req.socket.remoteAddress) || 'unknown'
}

/** 极简 .env 加载：只在文件存在时读取，已存在的环境变量优先 */
export function loadDotEnv(file) {
  try {
    if (!fs.existsSync(file)) return
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (!m) continue
      if (process.env[m[1]] !== undefined) continue
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  } catch (e) {
    /* 无 .env 时忽略 */
  }
}

export function handleError(res, e) {
  const status = e && e.status ? e.status : 500
  json(res, status, { error: (e && e.code) || 'INTERNAL_ERROR', message: (e && e.message) || '服务端异常' })
}
