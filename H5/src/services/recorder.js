// 移动端录音：MediaRecorder + getUserMedia（关闭降噪，保留原始语音特征）
const MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
  ''
]

export function isSupported() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder)
}

// 录音结束后必须释放麦克风：既省电，也避免部分安卓/微信 WebView 因麦克风
// 占用把播放输出切到听筒（表现为"播放了但听不见"）。
export function releaseMic(stream) {
  if (!stream) return
  try {
    stream.getTracks().forEach((t) => t.stop())
  } catch (e) {
    /* ignore */
  }
}

export async function requestMic() {
  if (!isSupported()) {
    throw new Error('当前浏览器不支持录音，请更换浏览器或在系统浏览器中打开')
  }
  return navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false
    }
  })
}

function pickMime() {
  for (const m of MIME_CANDIDATES) {
    if (!m) return ''
    if (window.MediaRecorder.isTypeSupported(m)) return m
  }
  return ''
}

export class Recorder {
  constructor(stream, onLevel) {
    this.stream = stream
    this.onLevel = onLevel || (() => {})
    this.chunks = []
    this.mr = null
    this.startedAt = 0
    this.mime = pickMime()
    this._ctx = null
    this._raf = null
  }

  start() {
    this.chunks = []
    const mr = new MediaRecorder(this.stream, this.mime ? { mimeType: this.mime } : undefined)
    mr.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) this.chunks.push(e.data)
    }
    mr.start(200)
    this.mr = mr
    this.startedAt = Date.now()
    this._startMeter()
  }

  stop() {
    return new Promise((resolve) => {
      const mr = this.mr
      this._stopMeter()
      if (!mr) return resolve(null)
      mr.onstop = () => {
        const durationMs = Date.now() - this.startedAt
        // 必须用 MediaRecorder 实际采用的 mimeType：用猜的值会让 Safari 拿到
        // mp4 数据却标成 webm，导致解码失败、无法试听。
        const mime = mr.mimeType || this.mime || 'audio/webm'
        const blob = new Blob(this.chunks, { type: mime })
        this.mr = null
        resolve({
          blob,
          size: blob.size,
          durationMs,
          mime,
          url: URL.createObjectURL(blob)
        })
      }
      mr.stop()
    })
  }

  get recording() {
    return !!this.mr && this.mr.state === 'recording'
  }

  _startMeter() {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    try {
      this._ctx = new Ctx()
      const source = this._ctx.createMediaStreamSource(this.stream)
      const analyser = this._ctx.createAnalyser()
      analyser.fftSize = 512
      source.connect(analyser)
      const data = new Uint8Array(analyser.frequencyBinCount)
      const tick = () => {
        analyser.getByteTimeDomainData(data)
        let sum = 0
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128
          sum += v * v
        }
        const rms = Math.sqrt(sum / data.length)
        this.onLevel(Math.min(100, Math.round(rms * 400)))
        this._raf = requestAnimationFrame(tick)
      }
      tick()
    } catch (e) {
      /* 音量条降级：不影响录音 */
    }
  }

  _stopMeter() {
    if (this._raf) cancelAnimationFrame(this._raf)
    this._raf = null
    if (this._ctx) {
      this._ctx.close().catch(() => {})
      this._ctx = null
    }
    this.onLevel(0)
  }
}
