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

/* ------------------------------------------------------------------ *
 * 「打开就回到上次结果」的两个会话标记
 *
 * 放 sessionStorage 而不是 localStorage：
 *   - 本轮已自动跳过，就别在用户点「再测一次」后又把人推回结果页；
 *   - 关掉重新打开（新会话）仍会自动回到结果页，这才是老板要的行为。
 * ------------------------------------------------------------------ */

const AUTO_RESULT = 'h5-speaking:auto-result'
const AUTO_RESULT_DONE = 'h5-speaking:auto-result-done'

export function hasAutoEntered() {
  try {
    return sessionStorage.getItem(AUTO_RESULT_DONE) === '1'
  } catch (e) {
    return false
  }
}

export function markAutoEntered(done = true) {
  try {
    if (done) sessionStorage.setItem(AUTO_RESULT_DONE, '1')
    sessionStorage.setItem(AUTO_RESULT, done ? '1' : '0')
  } catch (e) {
    /* ignore */
  }
}

export function isAutoEntered() {
  try {
    return sessionStorage.getItem(AUTO_RESULT) === '1'
  } catch (e) {
    return false
  }
}
