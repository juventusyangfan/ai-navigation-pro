<template>
  <div class="page">
    <!-- 未开始：年级选择 + 首页说明 -->
    <section v-if="!started" class="card">
      <h2 class="card-title">英语听说能力测评</h2>
      <p class="muted">请先选择测评年级，加载对应完整试卷（全程由腾讯云智聆口语评测提供发音评测）。</p>

      <div class="grades">
        <button
          v-for="g in GRADES"
          :key="g.id"
          class="grade-card"
          :class="{ active: selectedGrade === g.id }"
          @click="selectGrade(g.id)"
        >
          <span class="grade-label">{{ g.label }}</span>
          <span class="grade-desc">{{ g.desc }}</span>
        </button>
      </div>

      <template v-if="selectedGrade">
        <p class="muted small">
          {{ paper.title }} · 共 {{ paper.sections.length }} 个题型 · 满分 {{ paper.totalScore }} 分
        </p>
        <ul class="tips">
          <li>请在安静环境下完成，佩戴耳机可减少回声。</li>
          <li>首次点击录音会请求麦克风权限，请选择「允许」。</li>
          <li>本测评为练习反馈，不代表任何考试得分。</li>
        </ul>
        <button class="btn btn-primary btn-block" @click="start">开始测评（{{ gradeLabel }}）</button>
      </template>
      <p v-else class="muted small">尚未选择年级。</p>
    </section>

    <!-- 答题中 -->
    <template v-else>
      <div class="progress">
        <div class="progress-bar" :style="{ width: progressWidth }"></div>
      </div>
      <p class="progress-text">第 {{ stepIndex + 1 }} / {{ steps.length }} 题 · {{ current.sectionTitle }}</p>

      <section class="card">
        <h2 class="card-title">{{ current.sectionTitle }}</h2>
        <p class="muted tip-text">{{ current.sectionTip }}</p>

        <!-- 听后选择 -->
        <template v-if="current.type === 'choice'">
          <button class="btn btn-ghost" :disabled="playing" @click="playCurrent">
            {{ playing ? '播放中…' : '播放录音' }}
          </button>
          <p class="muted small">剩余重听次数：{{ replayLeft[current.id] }}</p>
          <p class="question">{{ current.question }}</p>
          <div class="options">
            <button
              v-for="(opt, i) in current.options"
              :key="i"
              class="option"
              :class="{ active: answers[current.id]?.choiceIndex === i }"
              @click="choose(i)"
            >
              <span class="option-key">{{ 'ABC'[i] }}</span>{{ opt }}
            </button>
          </div>
        </template>

        <!-- 口语题：模仿朗读 / 情景交际 / 信息转述（统一走智聆 SDK） -->
        <template v-else>
          <div v-if="current.passage" class="passage">{{ current.passage }}</div>

          <button
            v-if="current.audioText"
            class="btn btn-ghost"
            :disabled="playing"
            @click="playCurrent"
          >
            {{ playing ? '播放中…' : (current.type === 'read_aloud' ? '听示范朗读' : '播放录音') }}
          </button>
          <p v-if="current.replayLimit" class="muted small">剩余重听次数：{{ replayLeft[current.id] }}</p>

          <div v-if="current.keyPoints" class="keypoints">
            <span class="keypoints-title">要点提示</span>
            <span v-for="(k, i) in current.keyPoints" :key="i" class="chip">{{ k }}</span>
          </div>

          <!-- 情景交际 / 信息转述：展示参考范文，作为智聆评发音的 ref_text -->
          <div v-if="current.refText && current.type !== 'read_aloud'" class="passage ref">
            <span class="keypoints-title">{{ current.type === 'retell' ? '参考转述范文' : '参考范文' }}</span>
            <div class="ref-text">{{ current.refText }}</div>
          </div>

          <div class="record-box">
            <div v-if="prepareLeft > 0" class="prepare">
              准备时间 {{ prepareLeft }}s
              <button class="link" @click="skipPrepare">跳过</button>
            </div>

            <p class="record-time">
              <template v-if="evaluating">评测中…</template>
              <template v-else>{{ recording ? '录音中 ' : '时长 ' }}{{ fmtMs(recordingMs) }}</template>
              <span v-if="!recording && answers[current.id]?.rec" class="muted">/ 建议 {{ current.suggestSec }}s</span>
            </p>

            <button
              v-if="!recording"
              class="btn btn-primary btn-block"
              :disabled="prepareLeft > 0"
              @click="startRecord"
            >
              {{ answers[current.id]?.rec || answers[current.id]?.attempted ? '重新录音' : '开始录音' }}
            </button>
            <button v-else class="btn btn-stop btn-block" @click="stopRecord">结束录音</button>

            <div v-if="answers[current.id]?.rec" class="playback">
              <button class="btn btn-ghost" @click="togglePlay(current.id)">
                {{ playingId === current.id ? '停止试听' : '试听录音' }}
              </button>
              <span v-if="playInfo" class="muted small">
                时长 {{ playInfo.duration.toFixed(1) }}s<template v-if="playInfo.mode === 'webaudio'"> · 兼容模式</template>
              </span>
              <span v-if="playError" class="error small">{{ playError }}</span>
            </div>
            <p v-else-if="answers[current.id]?.attempted" class="muted small">
              本次录音过短或未采集到音频，暂无法试听。
            </p>
          </div>
        </template>
      </section>

      <div class="actions">
        <button class="btn btn-ghost" :disabled="stepIndex === 0" @click="prev">上一题</button>
        <button
          class="btn btn-primary"
          :disabled="!answered"
          @click="next"
        >
          {{ stepIndex === steps.length - 1 ? '提交并查看结果' : '下一题' }}
        </button>
      </div>

      <p v-if="error" class="error">{{ error }}</p>
      <p v-if="credError" class="muted small">{{ credError }}</p>
    </template>
  </div>
</template>

<script setup>
import { computed, onUnmounted, reactive, ref, toRaw } from 'vue'
import { GRADES, getPaper } from '../data/paper.js'
import { navigate } from '../router.js'
import { play, stopAll, ttsSupported } from '../services/audioPlayer.js'
import { startReadAloud, pcmToWav, toArrayBuffer } from '../services/soeSdk.js'
import { playRecorded, stopPlayback } from '../services/player.js'
import { buildResult } from '../services/evaluator.js'
import { saveResult, setAudio } from '../services/store.js'

const started = ref(false)
const selectedGrade = ref('')
const paper = ref(getPaper('grade7'))
const stepIndex = ref(0)
const answers = reactive({})
const error = ref('')
const credError = ref('')
const playing = ref(false)
const recording = ref(false)
const evaluating = ref(false)
const recordingMs = ref(0)
const prepareLeft = ref(0)

const replayLeft = reactive({})
const playingId = ref('')
const playInfo = ref(null)
const playError = ref('')

const gradeLabel = computed(() => (GRADES.find((g) => g.id === selectedGrade.value) || {}).label || '')

function selectGrade(id) {
  selectedGrade.value = id
  paper.value = getPaper(id)
}

const steps = computed(() => {
  const list = []
  paper.value.sections.forEach((s) => {
    s.items.forEach((it) => {
      list.push({
        ...it,
        type: s.type,
        sectionId: s.id,
        sectionTitle: s.title,
        sectionTip: s.tip,
        maxScore: s.score / s.items.length
      })
    })
  })
  return list
})
const current = computed(() => steps.value[stepIndex.value])
const progressWidth = computed(() => `${((stepIndex.value + 1) / steps.value.length) * 100}%`)
const answered = computed(() => {
  const a = answers[current.value.id]
  if (!a) return false
  if (current.value.type === 'choice') return typeof a.choiceIndex === 'number'
  // 口语题：只要评测有结果、或录到音、或已尝试过录音，即视为已作答。
  // 录音数据(rec)仅用于"能否试听"，不能作为"是否作答"的判据——否则取音频竞态或失败时
  // 会永久禁用"下一题"把用户锁死在该题。
  return !!(a.soe || a.rec || a.attempted)
})

let ctrl = null
let timer = null
let prepareTimer = null
let limitTimer = null

// SDK 返回的 16k/16bit 单声道 PCM 转 WAV，供本页试听与结果页回放。
// 注意：SDK 的 getAudio() 回传的**不是** ArrayBuffer，而是 WebRecorder 用
// `allAudioData.push(...new Int8Array(...))` 累积出来的「普通数组」（实测 2.4s 音频 =
// 77486 个字节元素）。必须经 toArrayBuffer 归一化，否则录音被判为「无数据」→ 试听按钮不出现。
function pcmToWavRec(pcm) {
  const buf = toArrayBuffer(pcm)
  if (!buf) return null
  const blob = pcmToWav(buf)
  const url = URL.createObjectURL(blob)
  const durationMs = Math.round((buf.byteLength / (16000 * 2)) * 1000)
  return { blob, url, durationMs }
}

function fmtMs(ms) {
  const s = Math.floor(ms / 1000)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

function start() {
  if (!selectedGrade.value) {
    error.value = '请先选择测评年级。'
    return
  }
  if (!ttsSupported) {
    error.value = '当前浏览器不支持语音合成，听力题将只显示文本（不影响作答）。'
  }
  started.value = true
  enterStep()
}

function enterStep() {
  const item = current.value
  if (replayLeft[item.id] === undefined && item.replayLimit) replayLeft[item.id] = item.replayLimit
  if (item.type !== 'choice' && item.prepareSec) {
    prepareLeft.value = item.prepareSec
    clearInterval(prepareTimer)
    prepareTimer = setInterval(() => {
      prepareLeft.value -= 1
      if (prepareLeft.value <= 0) clearInterval(prepareTimer)
    }, 1000)
  } else {
    prepareLeft.value = 0
  }
}

function skipPrepare() {
  clearInterval(prepareTimer)
  prepareLeft.value = 0
}

async function playCurrent() {
  const item = current.value
  if (replayLeft[item.id] !== undefined && replayLeft[item.id] <= 0) return
  error.value = ''
  playing.value = true
  try {
    await play(item)
    if (replayLeft[item.id] !== undefined) replayLeft[item.id] -= 1
  } catch (e) {
    error.value = e.message || '播放失败'
  } finally {
    playing.value = false
  }
}

function choose(i) {
  answers[current.value.id] = { choiceIndex: i }
}

async function startRecord() {
  error.value = ''
  credError.value = ''
  const item = current.value
  // 全口语题型统一走智聆 SDK 内置录音 + 评测（与 2026-09-18 调试记录参数一致：eval_mode=2 段落 / 16k_en）
  // ref_text 优先级：参考范文(refText) > 朗读/题干(passage) > 听力源文(audioText)
  const refText = item.refText || item.passage || item.audioText || ''
  try {
    ctrl = await startReadAloud({ refText, evalMode: 2, scoreCoeff: 2.5 })
  } catch (e) {
    const msg = e.message || String(e)
    // 密钥/服务类问题单独提示，引导去配置密钥服务，而不是当评测失败
    if (e.isCredential) {
      credError.value = msg + '（请确认 server 已配置真实密钥并运行 npm run server）'
    } else {
      error.value = msg
    }
    ctrl = null
    return
  }
  recording.value = true
  recordingMs.value = 0
  timer = setInterval(() => (recordingMs.value += 100), 100)
  const limit = (item.suggestSec || 30) * 2
  limitTimer = setTimeout(() => stopRecord(), limit * 1000)
}

async function togglePlay(itemId) {
  if (playingId.value === itemId) {
    stopPlayback()
    resetPlayState()
    return
  }
  stopPlayback()
  resetPlayState()
  const rec = answers[itemId] && answers[itemId].rec
  if (!rec) return
  try {
    const info = await playRecorded(toRaw(rec), () => resetPlayState())
    playingId.value = itemId
    playInfo.value = info
  } catch (e) {
    playError.value = '试听失败：浏览器无法播放该录音（' + (e.message || '未知原因') + '）'
  }
}

function resetPlayState() {
  playingId.value = ''
  playInfo.value = null
}

async function stopRecord() {
  clearInterval(timer)
  clearTimeout(limitTimer)
  const c = ctrl
  if (!c) {
    recording.value = false
    return
  }
  ctrl = null
  recording.value = false
  evaluating.value = true
  const id = current.value.id
  c.stop() // ★ 发送结束信令，服务端收到后回 final:1，c.done 才会 resolve；否则永远卡在「评测中」

  // 不论评测成功与否都取出已录音频，便于试听，并写入 answers 确保「下一题」可用。
  // 注意：socket 的 final:1 可能早于 recorder 的 onstop，getAudio() 首次可能为空，稍等重取一次。
  const saveAudio = async () => {
    // c.stop() 已同步触发 SDK 的 OnRecorderStop 写入音频；个别浏览器会晚一拍，最多重试 4 次
    for (let i = 0; i < 4; i++) {
      const rec = pcmToWavRec(c.getAudio())
      if (rec) return rec
      await new Promise((r) => setTimeout(r, 150))
    }
    return null
  }

  try {
    const soe = await c.done
    const rec = await saveAudio()
    if (soe && soe.noSpeech) {
      // 未检测到有效人声：不计分，但允许重录或直接进入下一题（不锁死）
      error.value = '未检测到有效语音，本题未计分。可点「重新录音」再试，或直接进入下一题。'
      answers[id] = { soe: null, rec, attempted: true, noSpeech: true }
      if (rec) setAudio(id, rec)
      evaluating.value = false
      return
    }
    answers[id] = { soe, rec, attempted: true }
    if (rec) setAudio(id, rec)
    evaluating.value = false
  } catch (e) {
    const msg = e.message || String(e)
    if (e.isCredential) credError.value = msg
    else error.value = msg + '（可点「重新录音」重试，或直接进入下一题）'
    // 评测失败也标记「已尝试」并保留录音，避免「下一题」被永久禁用而卡死
    let rec = null
    try {
      rec = await saveAudio()
    } catch (e2) {
      /* ignore */
    }
    answers[id] = { soe: null, rec, attempted: true, error: msg }
    if (rec) setAudio(id, rec)
    evaluating.value = false
  }
}

function next() {
  clearTimers()
  stopAll()
  stopPlayback()
  resetPlayState()
  if (stepIndex.value === steps.value.length - 1) {
    submit()
    return
  }
  stepIndex.value += 1
  enterStep()
}

function prev() {
  clearTimers()
  stopAll()
  stopPlayback()
  resetPlayState()
  if (stepIndex.value > 0) stepIndex.value -= 1
  enterStep()
}

function submit() {
  const result = buildResult(paper.value, answers)
  saveResult(result)
  navigate('/result')
}

function clearTimers() {
  clearInterval(prepareTimer)
  clearInterval(timer)
  clearTimeout(limitTimer)
  // 换题/离开页面时若仍在录音，先发结束信令释放麦克风与服务端会话，避免麦克风常开、会话卡死
  if (ctrl) {
    try {
      ctrl.stop()
    } catch (e) {
      /* ignore */
    }
    ctrl = null
  }
}

onUnmounted(() => {
  clearTimers()
  stopAll()
  stopPlayback()
  if (ctrl) {
    try {
      ctrl.stop()
    } catch (e) {
      /* ignore */
    }
  }
})
</script>

<style scoped>
.grades {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 14px 0;
}
.grade-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 12px 14px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: #fff;
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s, background 0.15s;
}
.grade-card:hover {
  border-color: var(--primary);
}
.grade-card.active {
  border-color: var(--primary);
  background: var(--primary);
  color: #fff;
}
.grade-label {
  font-size: 16px;
  font-weight: 600;
}
.grade-desc {
  font-size: 12px;
  opacity: 0.85;
  line-height: 1.4;
}
.passage.ref {
  margin-top: 12px;
  padding: 12px 14px;
  background: #f5f8ff;
  border: 1px dashed var(--line);
  border-radius: 10px;
}
.ref-text {
  margin-top: 6px;
  line-height: 1.6;
  color: var(--text);
}
</style>
