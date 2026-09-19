// 最小后端：只做一件事 —— 给 H5 下发智聆口语评测密钥。
// 不转发音频、不参与评测：音频由浏览器经官方 JS SDK 直连腾讯云 WSS，省掉一层转发延迟。
//
// 安全红线：SecretKey 绝不能写进前端代码。生产环境必须改为 STS 临时密钥
// （CAM GetFederationToken），默认配置会拒绝下发永久密钥。

import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import crypto from 'node:crypto'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
loadDotEnv(path.join(__dirname, '.env'))

const PORT = Number(process.env.PORT || 8787)
const ALLOW_STATIC = process.env.SOE_ALLOW_STATIC === '1'
const APPID = process.env.SOE_APPID || ''
const SECRET_ID = process.env.SOE_SECRET_ID || ''
const SECRET_KEY = process.env.SOE_SECRET_KEY || ''
// 兼容开关：显式设置 SOE_STS_ROLE_ARN 会强制走 STS（即便 SOE_ALLOW_STATIC 误开）。
// 实际 GetFederationToken 不需要 RoleArn —— 主密钥直接换临时凭证即可；此变量仅作「强制 STS」布尔开关。
const STS_ROLE_ARN = process.env.SOE_STS_ROLE_ARN || ''
// 生产默认 STS：未开本地调试、或显式强制 STS 时均走临时密钥；否则下发永久密钥（仅限调试）
const STS_ENABLED = !ALLOW_STATIC || !!STS_ROLE_ARN

const configured = !!(APPID && SECRET_ID && SECRET_KEY)

function loadDotEnv(file) {
  try {
    if (!fs.existsSync(file)) return
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (!m) continue
      const key = m[1]
      if (process.env[key] !== undefined) continue
      process.env[key] = m[2].replace(/^["']|["']$/g, '')
    }
  } catch (e) {
    /* 无 .env 时忽略 */
  }
}

function send(res, code, body) {
  const buf = Buffer.from(JSON.stringify(body), 'utf8')
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': buf.length,
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': process.env.SOE_ALLOW_ORIGIN || '*',
    'Access-Control-Allow-Headers': 'Content-Type'
  })
  res.end(buf)
}

// —— STS 临时密钥（生产路径）：用主密钥去换一张短期凭证，前端只拿到临时三件套 ——
// 官方文档：https://cloud.tencent.com/document/product/1774/107352
// 接口：sts.tencentcloudapi.com  GetFederationToken（TC3-HMAC-SHA256 签名）
// 权限策略采用最小原则：仅放开口语评测（新版）流式评测接口 soe:SpeakingAssessmentStream
let stsClientPromise = null
async function getStsClient() {
  if (!stsClientPromise) {
    stsClientPromise = (async () => {
      const tc = await import('tencentcloud-sdk-nodejs-sts')
      const sts = tc.sts || (tc.default && tc.default.sts)
      if (!sts || !sts.v20180813 || !sts.v20180813.Client) {
        throw new Error('STS SDK 结构异常：未找到 sts.v20180813.Client，请确认已安装 tencentcloud-sdk-nodejs-sts')
      }
      return new sts.v20180813.Client({
        credential: { secretId: SECRET_ID, secretKey: SECRET_KEY },
        region: 'ap-guangzhou',
        profile: { httpProfile: { endpoint: 'sts.tencentcloudapi.com' } }
      })
    })()
  }
  return stsClientPromise
}

async function fetchStsCredential() {
  if (!configured) {
    throw new Error('服务端主密钥未配置（SOE_SECRET_ID / SOE_SECRET_KEY 缺失），无法换取 STS 临时密钥')
  }
  const client = await getStsClient()
  // 最小权限策略：仅允许口语评测（新版）流式评测接口
  const policy = {
    version: '2.0',
    statement: [{ effect: 'allow', action: ['soe:SpeakingAssessmentStream'], resource: '*' }]
  }
  const r = await client.GetFederationToken({
    Name: 'SOE',
    Policy: JSON.stringify(policy),
    DurationSeconds: 1800
  })
  const c = r && r.Credentials
  if (!c || !c.TmpSecretId) {
    throw new Error('STS 返回异常：响应中缺少 Credentials.TmpSecretId')
  }
  return {
    secretid: c.TmpSecretId,
    secretkey: c.TmpSecretKey,
    token: c.Token,
    expired: r.ExpiredTime
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': process.env.SOE_ALLOW_ORIGIN || '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET,OPTIONS'
    })
    return res.end()
  }

  if (url.pathname === '/api/soe/health') {
    return send(res, 200, {
      ok: true,
      configured,
      mode: STS_ENABLED ? 'sts' : ALLOW_STATIC ? 'static' : 'refuse'
    })
  }

  if (url.pathname === '/api/soe/credential') {
    if (!configured) {
      return send(res, 503, {
        error: 'SOE_NOT_CONFIGURED',
        message: '服务端未配置 SOE_APPID / SOE_SECRET_ID / SOE_SECRET_KEY，请复制 server/.env.example 为 server/.env 并填写。'
      })
    }

    // 本地调试：明文永久密钥，必须显式开启 SOE_ALLOW_STATIC=1（且未强制 STS）
    if (ALLOW_STATIC && !STS_ROLE_ARN) {
      return send(res, 200, {
        appid: APPID,
        secretid: SECRET_ID,
        secretkey: SECRET_KEY,
        token: '',
        expired: Math.floor(Date.now() / 1000) + 3600,
        mode: 'static',
        warning: 'DEV ONLY：永久密钥已下发到浏览器，禁止用于生产环境。'
      })
    }

    // 生产路径：STS 临时密钥（永久密钥留服务端，浏览器只拿到临时三件套）
    try {
      const c = await fetchStsCredential()
      return send(res, 200, { appid: APPID, mode: 'sts', ...c })
    } catch (e) {
      return send(res, 501, { error: 'STS_FAILED', message: e.message })
    }
  }

  send(res, 404, { error: 'NOT_FOUND' })
})

server.listen(PORT, () => {
  const mode = STS_ENABLED ? 'sts(生产)' : 'static(DEV)'
  console.log(`[soe-cred] http://127.0.0.1:${PORT}  configured=${configured}  mode=${mode}`)
  if (!configured) console.log('[soe-cred] 未配置密钥，请先填写 server/.env')
  if (ALLOW_STATIC && !STS_ROLE_ARN) {
    console.log('[soe-cred] 警告：正在下发永久密钥（SOE_ALLOW_STATIC=1），仅限本地调试！')
  }
})

// 便于自检：导出签名算法，供 scripts/check-signature.mjs 复用
export function sign(secretKey, plain) {
  return crypto.createHmac('sha1', secretKey).update(plain).digest('base64')
}
