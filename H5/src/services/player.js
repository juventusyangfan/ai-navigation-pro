// 录音回放：优先原生 <audio>，失败自动降级到 WebAudio 解码播放。
//
// 为什么要这么绕：MediaRecorder 产出的 webm/mp4 容器里没有 duration 元数据，
// 浏览器拿到的 duration 是 Infinity —— 原生控件进度条失效，iOS Safari 上更会
// 直接点了没反应。所以这里先修 duration，修不好就改用 decodeAudioData 播放。

let audioEl = null
let waSource = null
let audioCtx = null

function getCtx() {
  const Ctor = window.AudioContext || window.webkitAudioContext
  if (!Ctor) return null
  if (!audioCtx) audioCtx = new Ctor()
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {})
  return audioCtx
}

export function stopPlayback() {
  if (audioEl) {
    audioEl.pause()
    try {
      audioEl.currentTime = 0
    } catch (e) {
      /* ignore */
    }
    audioEl.removeAttribute('src')
    audioEl = null
  }
  if (waSource) {
    try {
      waSource.stop()
    } catch (e) {
      /* ignore */
    }
    waSource = null
  }
}

function loadMeta(el) {
  return new Promise((resolve, reject) => {
    const done = false
    const onOk = () => {
      cleanup()
      resolve()
    }
    const onErr = () => {
      cleanup()
      reject(new Error('AUDIO_LOAD_FAILED'))
    }
    const cleanup = () => {
      el.removeEventListener('loadedmetadata', onOk)
      el.removeEventListener('canplay', onOk)
      el.removeEventListener('error', onErr)
      clearTimeout(timer)
    }
    const timer = setTimeout(() => {
      if (!done) {
        cleanup()
        reject(new Error('AUDIO_LOAD_TIMEOUT'))
      }
    }, 4000)
    el.addEventListener('loadedmetadata', onOk)
    el.addEventListener('canplay', onOk)
    el.addEventListener('error', onErr)
  })
}

// 把 Infinity 的 duration 逼出来：把 currentTime 设成极大值，容器会回溯出真实长度
function fixDuration(el) {
  return new Promise((resolve) => {
    if (Number.isFinite(el.duration) && el.duration > 0) {
      resolve(el.duration)
      return
    }
    const finish = () => {
      cleanup()
      try {
        el.currentTime = 0
      } catch (e) {
        /* ignore */
      }
      resolve(Number.isFinite(el.duration) && el.duration > 0 ? el.duration : 0)
    }
    const onChange = () => {
      if (Number.isFinite(el.duration) && el.duration > 0) finish()
    }
    const cleanup = () => {
      el.removeEventListener('durationchange', onChange)
      el.removeEventListener('timeupdate', onChange)
      clearTimeout(timer)
    }
    const timer = setTimeout(finish, 1500)
    el.addEventListener('durationchange', onChange)
    el.addEventListener('timeupdate', onChange)
    try {
      el.currentTime = 1e101
    } catch (e) {
      /* ignore */
    }
  })
}

async function playNative(url, onEnded) {
  const el = new Audio()
  el.src = url
  el.preload = 'auto'
  await loadMeta(el)
  const duration = await fixDuration(el)
  await el.play()
  audioEl = el
  el.addEventListener('ended', () => {
    audioEl = null
    onEnded()
  })
  return duration
}

async function playWebAudio(blob, onEnded) {
  const ctx = getCtx()
  if (!ctx) throw new Error('NO_WEB_AUDIO')
  const buf = await ctx.decodeAudioData(await blob.arrayBuffer())
  const src = ctx.createBufferSource()
  src.buffer = buf
  src.connect(ctx.destination)
  src.onended = () => {
    waSource = null
    onEnded()
  }
  src.start(0)
  waSource = src
  return buf.duration
}

/**
 * 播放一段录音。rec = { blob, url, durationMs }
 * @returns {Promise<{duration:number, mode:'native'|'webaudio'}>}
 */
export async function playRecorded(rec, onEnded = () => {}) {
  stopPlayback()
  const fallbackMs = rec.durationMs ? rec.durationMs / 1000 : 0
  try {
    const d = await playNative(rec.url, onEnded)
    return { duration: d || fallbackMs, mode: 'native' }
  } catch (e) {
    if (!rec.blob) throw e
    const d = await playWebAudio(rec.blob, onEnded)
    return { duration: d || fallbackMs, mode: 'webaudio' }
  }
}

export function isPlaying() {
  return !!audioEl || !!waSource
}
