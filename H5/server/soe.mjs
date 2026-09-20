// 智聆口语评测 · 服务端密钥下发。
//
// 安全红线：SecretKey 绝不能出现在前端代码里。生产默认走 CAM GetFederationToken
// 换临时密钥（前端只拿临时三件套），仅本地调试允许显式开启下发永久密钥。
//
// 官方文档：https://cloud.tencent.com/document/product/1774/107352
// 接口：sts.tencentcloudapi.com  GetFederationToken（TC3-HMAC-SHA256 签名）

import crypto from 'node:crypto'

export function getSoeConfig() {
  return {
    appid: process.env.SOE_APPID || '',
    secretId: process.env.SOE_SECRET_ID || '',
    secretKey: process.env.SOE_SECRET_KEY || '',
    // 本地调试开关：显式开启后才允许把永久密钥下发给浏览器
    allowStatic: process.env.SOE_ALLOW_STATIC === '1',
    // 兼容开关：设置任意值即强制走 STS（即便 SOE_ALLOW_STATIC 误开）
    stsRoleArn: process.env.SOE_STS_ROLE_ARN || '',
    origin: process.env.SOE_ALLOW_ORIGIN || '*'
  }
}

export function isConfigured(cfg = getSoeConfig()) {
  return !!(cfg.appid && cfg.secretId && cfg.secretKey)
}

export function mode(cfg = getSoeConfig()) {
  if (!isConfigured(cfg)) return 'unconfigured'
  return !cfg.allowStatic || cfg.stsRoleArn ? 'sts' : 'static'
}

export function health() {
  const cfg = getSoeConfig()
  return { ok: true, configured: isConfigured(cfg), mode: mode(cfg) }
}

let stsClientPromise = null
function getStsClient(cfg) {
  if (!stsClientPromise) {
    stsClientPromise = (async () => {
      const tc = await import('tencentcloud-sdk-nodejs-sts')
      const sts = tc.sts || (tc.default && tc.default.sts)
      if (!sts || !sts.v20180813 || !sts.v20180813.Client) {
        throw new Error('STS SDK 结构异常：未找到 sts.v20180813.Client，请确认已安装 tencentcloud-sdk-nodejs-sts')
      }
      return new sts.v20180813.Client({
        credential: { secretId: cfg.secretId, secretKey: cfg.secretKey },
        region: 'ap-guangzhou',
        profile: { httpProfile: { endpoint: 'sts.tencentcloudapi.com' } }
      })
    })()
  }
  return stsClientPromise
}

function httpError(status, code, message) {
  const e = new Error(message)
  e.status = status
  e.code = code
  return e
}

/** 主密钥 → STS 临时凭证（最小权限：仅放开口语评测流式接口） */
export async function fetchStsCredential(cfg = getSoeConfig()) {
  if (!isConfigured(cfg)) {
    throw httpError(503, 'SOE_NOT_CONFIGURED', '服务端主密钥未配置（SOE_SECRET_ID / SOE_SECRET_KEY 缺失），无法换取 STS 临时密钥')
  }
  const client = await getStsClient(cfg)
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
  if (!c || !c.TmpSecretId) throw httpError(502, 'STS_BAD_RESPONSE', 'STS 返回异常：响应中缺少 Credentials.TmpSecretId')
  return { secretid: c.TmpSecretId, secretkey: c.TmpSecretKey, token: c.Token, expired: r.ExpiredTime }
}

/** 下发智聆评测凭证：生产走 STS，本地调试可下发永久密钥 */
export async function credential() {
  const cfg = getSoeConfig()
  if (!isConfigured(cfg)) {
    throw httpError(503, 'SOE_NOT_CONFIGURED', '服务端未配置 SOE_APPID / SOE_SECRET_ID / SOE_SECRET_KEY，请复制 server/.env.example 为 server/.env 并填写。')
  }
  if (cfg.allowStatic && !cfg.stsRoleArn) {
    return {
      appid: cfg.appid,
      secretid: cfg.secretId,
      secretkey: cfg.secretKey,
      token: '',
      expired: Math.floor(Date.now() / 1000) + 3600,
      mode: 'static',
      warning: 'DEV ONLY：永久密钥已下发到浏览器，禁止用于生产环境。'
    }
  }
  try {
    return { appid: cfg.appid, mode: 'sts', ...(await fetchStsCredential(cfg)) }
  } catch (e) {
    if (e.status) throw e
    throw httpError(501, 'STS_FAILED', e.message)
  }
}

// 便于自检：导出签名算法（与智聆 Web SDK 的 URL 签名口径一致）
export function sign(secretKey, plain) {
  return crypto.createHmac('sha1', secretKey).update(plain).digest('base64')
}
