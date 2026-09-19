// 听力/示范音频播放：优先使用配置好的音频文件，无文件时用浏览器 TTS 朗读文本
// 目的：MVP 零音频素材成本，后续替换为真实录音素材只需在 paper.js 填 audioUrl

let audioEl = null

export const ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window

function pickVoice(lang = 'en-US') {
  const voices = window.speechSynthesis.getVoices() || []
  return (
    voices.find((v) => v.lang && v.lang.toLowerCase().startsWith(lang.slice(0, 2))) ||
    voices.find((v) => /en/i.test(v.lang || '')) ||
    null
  )
}

export function stopAll() {
  try {
    window.speechSynthesis.cancel()
  } catch (e) {
    /* ignore */
  }
  if (audioEl) {
    audioEl.pause()
    audioEl.currentTime = 0
    audioEl = null
  }
}

/** 播放一段音频/文本，返回 Promise（播放结束 resolve） */
export function play(item) {
  stopAll()
  if (!item) return Promise.resolve()

  if (item.audioUrl) {
    return new Promise((resolve, reject) => {
      audioEl = new Audio(item.audioUrl)
      audioEl.onended = () => resolve()
      audioEl.onerror = () => reject(new Error('音频播放失败'))
      audioEl.play().catch(reject)
    })
  }

  if (!item.audioText) return Promise.resolve()

  return new Promise((resolve) => {
    const utter = new SpeechSynthesisUtterance(item.audioText)
    utter.lang = 'en-US'
    utter.rate = 0.9
    const voice = pickVoice('en-US')
    if (voice) utter.voice = voice
    utter.onend = () => resolve()
    utter.onerror = () => resolve()
    window.speechSynthesis.speak(utter)
  })
}
