// 腾讯云智聆口语评测（新版）Web SDK 封装 —— 仅做「模仿朗读」单题型闭环。
//
// 链路：H5 →(HTTP) 自建后端拿密钥 → 官方 SDK 内置录音(16k PCM) → wss://soe.cloud.tencent.com
// 官方 SDK：https://github.com/TencentCloud/tencentcloud-speech-sdk-js （soe 目录，v1.0.1）
// 接口文档：https://cloud.tencent.com/document/product/1774/107497
//
// 说明：官方新版没有 Node.js SDK，Web 端只有这个 JS SDK；SDK 内部已处理
// 麦克风采集、重采样、分片节奏与签名，所以这里不再自己撸 WSS。

const SDK_URL = (import.meta.env.BASE_URL || '/') + 'vendor/TencentSOE-1.0.1.js'

let sdkLoading = null

export function loadSoeSdk() {
  if (window.SowNewSocketSdk) return Promise.resolve(window.SowNewSocketSdk)
  if (sdkLoading) return sdkLoading
  sdkLoading = new Promise((resolve, reject) => {
    const el = document.createElement('script')
    // 官方 dist 末尾带 `export{w as default}`，是 webpack module 产物，
    // 必须用 type="module" 加载，否则报 Unexpected token 'export'。
    // 其模块体内仍会执行 window.SowNewSocketSdk = ...，所以照旧从 window 取。
    el.type = 'module'
    el.src = SDK_URL
    el.onload = () =>
      window.SowNewSocketSdk
        ? resolve(window.SowNewSocketSdk)
        : reject(new Error('SDK 已加载，但未导出 SowNewSocketSdk'))
    el.onerror = () => reject(new Error('SDK 加载失败：' + SDK_URL))
    document.head.appendChild(el)
  })
  return sdkLoading
}

export async function fetchCredential() {
  const base = import.meta.env.VITE_API_BASE || ''
  let res
  try {
    res = await fetch(`${base}/api/soe/credential`, { cache: 'no-store' })
  } catch (e) {
    throw credError('无法连接密钥服务，请确认已启动 npm run server（默认 127.0.0.1:8787）')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw credError(data.message || `获取密钥失败（HTTP ${res.status}）`)
  return data
}

// 密钥/服务类错误单独标记，页面据此给出「去配置密钥」的引导而不是当评测失败
export function credError(msg) {
  const e = new Error(msg)
  e.isCredential = true
  return e
}

// 腾讯服务端常见错误的友好化映射（SDK 的 OnError 直接回传字符串原文）
// 实测样本：'账号未开通本服务，请在控制台开通服务'
const SOE_HINTS = [
  [
    /未开通|未开通本服务|服务未开通/,
    '账号尚未开通「智聆口语评测」服务。请到控制台 https://console.cloud.tencent.com/soe 开通后重试。'
  ],
  [/欠费|余额不足|arrears|insufficient/i, '账号欠费或免费额度已用完，请在控制台充值或购买资源包。'],
  [
    /签名|鉴权|AuthFail|鉴权失败|Signature/i,
    '签名校验失败：请核对 SecretId / SecretKey / AppId 三者是否匹配同一账号（AppId 是腾讯云账号 APPID，不是微信 AppId）。'
  ],
  [/并发|超限|超出.*限制|concurrency|limit/i, '并发超限：默认 50 路并发，超额需购买并发资源包。'],
  [/无效语音|未检测到|静音|no speech|无有效/i, '未检测到有效语音：请检查麦克风授权与环境噪音，朗读声音稍大一些后重录。'],
  [/超时|timeout/i, '评测超时，请检查网络后重试。']
]

function toError(e) {
  const raw = typeof e === 'string' ? e : e && e.message ? e.message : ''
  if (!raw) return new Error('评测失败：连接被关闭（未收到最终结果）')
  const hit = SOE_HINTS.find(([re]) => re.test(raw))
  const err = new Error(hit ? `${hit[1]}（原文：${raw}）` : `评测失败：${raw}`)
  err.raw = raw
  return err
}

const num = (v) => (typeof v === 'number' ? v : v === '' || v == null ? null : Number(v))
const r1 = (v) => (v == null ? null : Math.round(v * 10) / 10)

function findNum(s, key) {
  const m = s.match(new RegExp(key + ':\\s*(-?[\\d.]+)'))
  return m ? Number(m[1]) : null
}

// 实测（2026-09-18 真实调用）：新版 SDK 的 OnEvaluationComplete 回传的 result 已经是
// **解析好的 JSON 对象**，不是文档示例里那种 Go 结构体风格字符串。
// 下面仍保留字符串分支，作为历史版本 / 不同 SDK 版本的兜底。
function parseResult(raw) {
  if (raw == null) return {}
  if (typeof raw === 'object') {
    return {
      SuggestedScore: num(raw.SuggestedScore),
      PronAccuracy: num(raw.PronAccuracy),
      PronFluency: num(raw.PronFluency),
      PronCompletion: num(raw.PronCompletion),
      Words: Array.isArray(raw.Words) ? raw.Words.map(pickWord) : []
    }
  }
  const s = String(raw)
  return {
    SuggestedScore: findNum(s, 'SuggestedScore'),
    PronAccuracy: findNum(s, 'PronAccuracy'),
    PronFluency: findNum(s, 'PronFluency'),
    PronCompletion: findNum(s, 'PronCompletion'),
    Words: parseWords(s)
  }
}

function pickWord(w) {
  return {
    word: w.Word || w.word || '',
    ref: w.ReferenceWord || '',
    accuracy: num(w.PronAccuracy),
    matchTag: num(w.MatchTag ?? w.Tag)
  }
}

function parseWords(s) {
  const at = s.indexOf('Words:[')
  if (at < 0) return []
  const seg = s.slice(at + 7)
  const out = []
  const re = /\{([^{}]*)\}/g
  let m
  while ((m = re.exec(seg))) {
    const b = m[1]
    const grab = (key) => {
      const x = b.match(new RegExp('(?:^|[ ,{])' + key + ':\\s*([^\\s]*)'))
      if (!x) return ''
      const v = x[1]
      return v && !v.includes(':') ? v : ''
    }
    const acc = findNum(b, 'PronAccuracy')
    const tag = b.match(/(?:^|[ ,{])Tag:\s*(\d+)/)
    const word = grab('Word')
    if (!word && acc == null) continue
    out.push({
      word,
      ref: grab('ReferenceWord'),
      accuracy: acc,
      matchTag: tag ? Number(tag[1]) : null
    })
  }
  return out
}

export function normalizeResult(res) {
  const p = parseResult(res && res.result)
  const accuracy = p.PronAccuracy != null && p.PronAccuracy >= 0 ? p.PronAccuracy : null
  const fluency01 = p.PronFluency != null && p.PronFluency >= 0 ? p.PronFluency : null
  const completion01 = p.PronCompletion != null && p.PronCompletion >= 0 ? p.PronCompletion : null

  // 综合分：优先用官方 SuggestedScore；缺失时按官方基础版公式推算
  // SuggestedScore = PronAccuracy × PronCompletion × (2 − PronCompletion)
  let suggested = p.SuggestedScore != null && p.SuggestedScore > 0 ? p.SuggestedScore : null
  if (suggested == null && accuracy != null && completion01 != null) {
    suggested = accuracy * completion01 * (2 - completion01)
  }

  // 无效语音判定（实测样本：无有效人声时 SuggestedScore=0 / PronAccuracy=0 /
  // PronCompletion=0 / PronFluency=-1 / Words=[]）。不处理的话学生会看到一个莫名其妙的 0 分。
  const noSpeech =
    (accuracy == null || accuracy === 0) &&
    (completion01 == null || completion01 === 0) &&
    (!p.Words || p.Words.length === 0)

  return {
    noSpeech,
    voiceId: (res && res.voice_id) || '',
    accuracy: r1(accuracy),
    fluency: fluency01 == null ? null : r1(fluency01 * 100),
    completion: completion01 == null ? null : r1(completion01 * 100),
    suggested: r1(suggested),
    score5: noSpeech || suggested == null ? null : r1(Math.max(0, Math.min(100, suggested)) / 20),
    words: p.Words || [],
    raw: res
  }
}

/**
 * 发起一次「模仿朗读」评测（eval_mode=2 段落模式）。
 * @returns {{done: Promise<object>, stop: Function, getAudio: Function}}
 */
export async function startReadAloud({ refText, scoreCoeff = 2.5, onChange } = {}) {
  const Sdk = await loadSoeSdk()
  const cred = await fetchCredential()

  const params = {
    appid: String(cred.appid || ''),
    secretid: cred.secretid || '',
    secretkey: cred.secretkey || '',
    token: cred.token || '',
    server_engine_type: '16k_en',
    eval_mode: 2,
    ref_text: refText,
    score_coeff: scoreCoeff,
    sentence_info_enabled: 1,
    text_mode: 0
  }

  const sdk = new Sdk(params, false)
  let audioData = null

  const done = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('评测超时：120 秒内未收到最终结果')), 120000)
    const finish = (v) => {
      clearTimeout(timer)
      resolve(v)
    }
    const fail = (e) => {
      clearTimeout(timer)
      reject(toError(e))
    }
    sdk.OnEvaluationStart = () => {}
    sdk.OnEvaluationResultChange = (r) => {
      if (onChange) onChange(normalizeResult(r))
    }
    sdk.OnEvaluationComplete = (r) => finish(normalizeResult(r))
    sdk.OnError = fail
    sdk.OnRecorderStop = (d) => {
      audioData = d
    }
    try {
      // v1.0.1 的 start() 不接参数，参数来自构造函数；这里多传一次兼容 README 写法
      sdk.start(params)
    } catch (e) {
      fail(e)
    }
  })

  return {
    done,
    stop: () => {
      try {
        sdk.stop()
      } catch (e) {
        /* ignore */
      }
    },
    getAudio: () => audioData
  }
}

// SDK 回传的音频可能是 PCM(ArrayBuffer)，包一层 WAV 头才能用 <audio> 播放
export async function toWavUrl(data, sampleRate = 16000) {
  if (!data) return null
  if (typeof data === 'string') return data
  if (data instanceof Blob) {
    if (data.type && data.type !== 'application/octet-stream') return URL.createObjectURL(data)
    return data.arrayBuffer().then((b) => URL.createObjectURL(pcmToWav(b, sampleRate)))
  }
  const buf =
    data instanceof ArrayBuffer
      ? data
      : data.buffer instanceof ArrayBuffer
        ? data.buffer.slice(data.byteOffset || 0, (data.byteOffset || 0) + data.byteLength)
        : null
  if (!buf) return null
  return URL.createObjectURL(pcmToWav(buf, sampleRate))
}

export function pcmToWav(pcm, sampleRate = 16000) {
  const len = pcm.byteLength || pcm.length
  const view = new DataView(new ArrayBuffer(44 + len))
  const w = (off, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i))
  }
  w(0, 'RIFF')
  view.setUint32(4, 36 + len, true)
  w(8, 'WAVE')
  w(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  w(36, 'data')
  view.setUint32(40, len, true)
  const src = new Uint8Array(pcm instanceof ArrayBuffer ? pcm : pcm.buffer || pcm)
  new Uint8Array(view.buffer).set(src, 44)
  return new Blob([view.buffer], { type: 'audio/wav' })
}
