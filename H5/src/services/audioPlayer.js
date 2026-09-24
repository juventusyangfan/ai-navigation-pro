// 题目音频播放（听力录音 / 示范朗读）；用户自己录音的回放见 player.js。
//
// ── 音源优先级（移动端可靠性的地基） ──────────────────────────────────────────
// 1) item.audioUrl —— 真人 / 官方录音。走原生 <audio> + Range 请求，可被 CDN 缓存。
// 2) item.audioText —— 服务端腾讯云语音合成（GET /api/tts/audio）。同样是原生
//    <audio> 播放，与真人录音走完全相同的播放路径，移动端 100% 可达。
// 3) 两者都没有 → NO_SOURCE，由页面提示「本题暂无音频」。
//
// ── 为什么彻底去掉浏览器 speechSynthesis ────────────────────────────────────
// 移动端（微信 X5 / WKWebView / 各家 WebView）对 speechSynthesis 支持残缺，
// 且失败是「静默的」：既不触发 onend 也不触发 onerror，只能靠超时兜底，
// 前端无法区分「慢」与「坏」，必然表现为「扣了次数却没声音」。
// 语音合成本就属于服务端能力，已统一上移到 server（见 server/tts.mjs）。
//
// ── 播放的可靠性细节（踩过坑，勿删） ────────────────────────────────────────
// · 只有收到 playing 事件才算「真的出声」→ onStart 回调据此扣减播放次数。
// · 必须设超时守卫：迟迟不出声时给出「可重试的失败」，而不是永远停在「播放中…」。
// · stopAll() 要主动终结挂起的 Promise，否则切题后按钮永久卡在「播放中…」。
// · iOS/WKWebView 的首播须落在用户手势内 → unlockAudio() 在首次点击里预热。

// 音频相关超时：弱网下若不设守卫，「播放中…」会无限挂起
const AUDIO_START_TIMEOUT = 8000 // 超过此时长仍未出声 → 判定加载失败（可重试）
const AUDIO_END_TIMEOUT = 120000 // 兜底：ended 不触发时强制收尾（最长题目音频约 60s）
const TTS_HEALTH_TIMEOUT = 5000 // 服务端合成能力探测超时

const isBrowser = typeof window !== 'undefined'

let audioEl = null
let playGen = 0 // 世代号：stopAll / 新播放都会 +1，用于作废旧回调
let unlocked = false // 音频通道是否已解锁
let currentAbort = null // 当前挂起播放的终结函数（stopAll 时主动调用，避免 Promise 悬挂）
let ttsReady = null // null=未探测 true/false=服务端合成是否可用
let ttsHealth = null

function makeError(code, message) {
  const e = new Error(message)
  e.code = code
  return e
}

function apiBase() {
  try {
    return import.meta.env.VITE_API_BASE || ''
  } catch (e) {
    return ''
  }
}

/** 题目文本 → 服务端语音合成地址（同源 /api，Nginx 反代到密钥服务） */
export function ttsAudioUrl(text, voice = 'auto') {
  const q = new URLSearchParams({ text: String(text || '').trim(), voice })
  return `${apiBase()}/api/tts/audio?${q.toString()}`
}

/**
 * 探测服务端语音合成能力（页面加载时调用一次即可）。
 * 未就绪时页面提前降级提示，而不是等用户点了播放才失败。
 */
export async function probeTts(force = false) {
  if (ttsReady !== null && !force) return ttsReady
  try {
    const ctl = typeof AbortController === 'function' ? new AbortController() : null
    const timer = ctl ? setTimeout(() => ctl.abort(), TTS_HEALTH_TIMEOUT) : null
    const res = await fetch(`${apiBase()}/api/tts/health`, {
      cache: 'no-store',
      signal: ctl ? ctl.signal : undefined
    })
    if (timer) clearTimeout(timer)
    const data = await res.json()
    ttsHealth = data
    ttsReady = !!(res.ok && data && data.ok)
  } catch (e) {
    ttsHealth = { ok: false, error: 'NETWORK' }
    ttsReady = false
  }
  return ttsReady
}

export function isTtsReady() {
  return ttsReady === true
}

export function getTtsHealth() {
  return ttsHealth
}

/** 该题是否依赖服务端合成（无真人录音） */
export function usesServerTts(item) {
  return !!(item && !item.audioUrl && (item.audioText || '').trim())
}

export function isUnlocked() {
  return unlocked
}

/**
 * 音频通道解锁：在「用户手势的同步调用栈」内调用一次（如首次点击）。
 * iOS/Safari 与多数 WebView 在解锁前会静默丢弃音频。
 */
export function unlockAudio() {
  if (!isBrowser || unlocked) return
  unlocked = true
  try {
    const Ctor = window.AudioContext || window.webkitAudioContext
    if (!Ctor) return
    const ctx = new Ctor()
    const src = ctx.createBufferSource()
    src.buffer = ctx.createBuffer(1, 1, 22050)
    src.connect(ctx.destination)
    src.start(0)
    setTimeout(() => {
      try {
        ctx.close()
      } catch (e) {
        /* ignore */
      }
    }, 300)
  } catch (e) {
    /* ignore */
  }
}

/** 停止一切播放 */
export function stopAll() {
  playGen += 1
  if (currentAbort) {
    const abort = currentAbort
    currentAbort = null
    abort()
  }
  if (audioEl) {
    try {
      audioEl.pause()
    } catch (e) {
      /* ignore */
    }
    try {
      audioEl.removeAttribute('src')
    } catch (e) {
      /* ignore */
    }
    audioEl = null
  }
}

/** 把播放异常翻译成用户可读、可操作的提示 */
export function describePlayError(e) {
  const code = (e && e.code) || ''
  const msg = (e && e.message) || ''
  switch (code) {
    case 'TTS_UNAVAILABLE':
      return '服务端语音合成暂不可用，本题音频无法播放，请稍后重试。'
    case 'AUDIO_LOAD_FAILED':
      // 音源是服务端合成时，失败原因基本不可能是用户网络，
      // 指向网络会让排查跑偏（真实原因多为密钥失效 / 服务未开通 / 配额用尽）。
      return lastPlayWasTts
        ? '服务端合成音频加载失败（非网络问题），请执行 npm run tts:check 查看具体原因。'
        : '音频加载失败，请检查网络后重试。'
    case 'AUDIO_PLAY_BLOCKED':
      return '浏览器拦截了本次音频播放，请再点一次「播放录音」。'
    default:
      return msg || '播放失败'
  }
}

/** 相对路径按「文档地址」解析：构建 base 为 './'，部署到任意子目录都能取到正确地址 */
function resolveAudioUrl(url) {
  try {
    return new URL(url, document.baseURI).href
  } catch (e) {
    return url
  }
}

function playFile(url, onStart) {
  return new Promise((resolve, reject) => {
    const gen = playGen
    let started = false
    let settled = false
    let startTimer = null
    let endTimer = null
    let el

    const cleanup = () => {
      clearTimeout(startTimer)
      clearTimeout(endTimer)
      if (currentAbort === abort) currentAbort = null
    }
    const done = () => {
      if (settled) return
      settled = true
      cleanup()
      if (audioEl === el) audioEl = null
      resolve({ played: true, source: 'file' })
    }
    const fail = (code, message) => {
      if (settled) return
      settled = true
      cleanup()
      if (audioEl === el) audioEl = null
      try {
        el.pause()
      } catch (e) {
        /* ignore */
      }
      reject(makeError(code, message))
    }

    try {
      el = new Audio()
      el.preload = 'auto'
      el.setAttribute('playsinline', '')
      el.setAttribute('webkit-playsinline', '')
      el.src = resolveAudioUrl(url)
    } catch (e) {
      reject(makeError('AUDIO_LOAD_FAILED', '音频加载失败'))
      return
    }
    // 供 stopAll() 主动终结挂起的播放：否则切题/停播后 Promise 永不 settle，
    // 调用方的 finally 不执行，「播放中…」会把下一题的按钮永久卡死。
    const abort = () => fail('PLAY_ABORTED', '播放已中断')
    currentAbort = abort
    audioEl = el

    el.addEventListener('playing', () => {
      if (gen !== playGen || settled) return
      if (!started) {
        started = true
        clearTimeout(startTimer)
        // [!] 只有确认出声，才通知调用方扣减播放次数
        if (onStart) onStart()
        endTimer = setTimeout(done, AUDIO_END_TIMEOUT)
      }
    })
    el.addEventListener('ended', () => {
      if (gen !== playGen) return
      done()
    })
    el.addEventListener('error', () => {
      if (gen !== playGen) return
      fail('AUDIO_LOAD_FAILED', '音频文件加载失败')
    })

    // 弱网守卫：迟迟不出声就给出「可重试的失败」，而不是永远停在「播放中…」
    startTimer = setTimeout(() => {
      if (gen !== playGen || started) return
      fail('AUDIO_LOAD_FAILED', '音频加载超时')
    }, AUDIO_START_TIMEOUT)

    let p
    try {
      p = el.play()
    } catch (e) {
      fail('AUDIO_PLAY_BLOCKED', '浏览器拦截了音频播放')
      return
    }
    if (p && typeof p.catch === 'function') {
      p.catch(() => {
        if (gen !== playGen) return
        fail('AUDIO_PLAY_BLOCKED', '浏览器拦截了音频播放')
      })
    }
  })
}

/**
 * 播放一段题目音频。
 * @param item {{audioUrl?:string, audioText?:string}}
 * @param opts {{onStart?:() => void}} onStart 在「确认出声」时触发，用于扣减播放次数
 * @returns {Promise<{played:boolean, source?:string, reason?:string}>}
 */
export function play(item, opts = {}) {
  const onStart = typeof opts.onStart === 'function' ? opts.onStart : null
  if (!item) {
    stopAll()
    return Promise.resolve({ played: false, reason: 'EMPTY' })
  }

  // 服务端合成未就绪时立即给出明确失败，不让用户白等 8 秒
  if (usesServerTts(item) && ttsReady === false) {
    stopAll()
    // 带上探针原因，让用户看到「密钥失效」而不是一句笼统的「不可用」
    const reason = ttsHealth && ttsHealth.probe && ttsHealth.probe.message
    return Promise.reject(
      makeError('TTS_UNAVAILABLE', '服务端语音合成不可用' + (reason ? `：${reason}` : ''))
    )
  }

  // 1) 真人 / 官方录音优先
  // 2) 服务端语音合成
  const text = (item.audioText || '').trim()
  const url = item.audioUrl || (text ? ttsAudioUrl(text) : '')
  lastPlayWasTts = !!text && !item.audioUrl
  if (!url) {
    stopAll()
    return Promise.resolve({ played: false, reason: 'NO_SOURCE' })
  }
  stopAll()
  return playFile(url, onStart)
}

/**
 * 预取题目音频（切题时调用）：只预热浏览器缓存，不播放、不影响播放次数。
 * 对服务端合成，这一步会触发云端合成并落缓存，用户点击时可秒开。
 */
export function preloadAudio(item) {
  if (!isBrowser || !item) return
  const text = typeof item === 'string' ? '' : (item.audioText || '').trim()
  const url =
    typeof item === 'string' ? item : item.audioUrl || (text ? ttsAudioUrl(text) : '')
  if (!url) return
  if (typeof item !== 'string' && !item.audioUrl && ttsReady === false) return
  try {
    const el = new Audio()
    el.preload = 'auto'
    el.src = resolveAudioUrl(url)
    el.load()
  } catch (e) {
    /* ignore */
  }
}
