// 结果存取：结构化数据存 localStorage，音频（blob + blob URL）仅存内存（刷新即失效）
const KEY = 'h5-speaking:last-result'
const audioMap = new Map()

// 回放需要 blob：原生播放失败时要降级到 WebAudio 解码，只有 URL 不够
export function setAudio(itemId, rec) {
  audioMap.set(itemId, { url: rec.url, blob: rec.blob, durationMs: rec.durationMs })
}

export function getAudio(itemId) {
  return audioMap.get(itemId) || null
}

export function getAudioUrl(itemId) {
  const a = audioMap.get(itemId)
  return a ? a.url : null
}

export function saveResult(result) {
  try {
    localStorage.setItem(KEY, JSON.stringify(result))
  } catch (e) {
    /* 隐私模式下降级：仅保留内存 */
  }
}

export function loadResult() {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : null
  } catch (e) {
    return null
  }
}

export function clearResult() {
  try {
    localStorage.removeItem(KEY)
  } catch (e) {
    /* ignore */
  }
  audioMap.clear()
}
