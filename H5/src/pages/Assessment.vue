<template>
  <div class="page">
    <!-- 未开始：首页说明 -->
    <section v-if="!started" class="card">
      <h2 class="card-title">{{ paper.title }}</h2>
      <p class="muted">共 {{ paper.sections.length }} 个题型，满分 {{ paper.totalScore }} 分，约需 5 分钟。</p>
      <ul class="tips">
        <li>请在安静环境下完成，佩戴耳机可减少回声。</li>
        <li>首次点击录音会请求麦克风权限，请选择「允许」。</li>
        <li>本测评为练习反馈，不代表任何考试得分。</li>
      </ul>
      <button class="btn btn-primary btn-block" @click="start">开始测评</button>
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

        <!-- 口语题：模仿朗读 / 情景交际 / 信息转述 -->
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

          <div class="record-box">
            <div v-if="prepareLeft > 0" class="prepare">
              准备时间 {{ prepareLeft }}s
              <button class="link" @click="skipPrepare">跳过</button>
            </div>

            <div class="meter">
              <div class="meter-fill" :style="{ width: level + '%' }"></div>
            </div>
            <p class="record-time">
              {{ recording ? '录音中 ' : '时长 ' }}{{ fmtMs(recordingMs) }}
              <span v-if="!recording && answers[current.id]?.rec" class="muted">/ 建议 {{ current.suggestSec }}s</span>
            </p>

            <button
              v-if="!recording"
              class="btn btn-primary btn-block"
              :disabled="prepareLeft > 0"
              @click="startRecord"
            >
              {{ answers[current.id]?.rec ? '重新录音' : '开始录音' }}
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
    </template>
  </div>
</template>

<script setup>
import { computed, onUnmounted, reactive, ref, toRaw } from 'vue'
import { paper } from '../data/paper.js'
import { navigate } from '../router.js'
import { play, stopAll, ttsSupported } from '../services/audioPlayer.js'
import { Recorder, isSupported, requestMic, releaseMic } from '../services/recorder.js'
import { playRecorded, stopPlayback } from '../services/player.js'
import { buildResult } from '../services/evaluator.js'
import { saveResult, setAudio } from '../services/store.js'

const started = ref(false)
const stepIndex = ref(0)
const answers = reactive({})
const error = ref('')
const playing = ref(false)
const recording = ref(false)
const recordingMs = ref(0)
const level = ref(0)
const prepareLeft = ref(0)

const replayLeft = reactive({})
const playingId = ref('')
const playInfo = ref(null)
const playError = ref('')
const steps = computed(() => {
  const list = []
  paper.sections.forEach((s) => {
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
  return current.value.type === 'choice' ? typeof a.choiceIndex === 'number' : !!a.rec
})

let stream = null
let recorder = null
let timer = null
let prepareTimer = null
let limitTimer = null

function fmtMs(ms) {
  const s = Math.floor(ms / 1000)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

function start() {
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
  if (!isSupported()) {
    error.value = '当前浏览器不支持录音，请更换浏览器或在系统浏览器中打开（微信内请点右上角「用浏览器打开」）。'
    return
  }
  try {
    if (!stream) {
      stream = await requestMic()
      recorder = new Recorder(stream, (v) => (level.value = v))
    }
    recordingMs.value = 0
    recorder.start()
    recording.value = true
    timer = setInterval(() => (recordingMs.value += 100), 100)
    const limit = (current.value.suggestSec || 30) * 2
    limitTimer = setTimeout(() => stopRecord(), limit * 1000)
  } catch (e) {
    error.value = e.message || '无法访问麦克风，请检查权限设置。'
  }
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
  if (!recorder) return
  const rec = await recorder.stop()
  recording.value = false
  // 录音结束立刻释放麦克风：否则部分安卓/微信 WebView 会把播放输出切到听筒
  releaseMic(stream)
  stream = null
  recorder = null
  if (rec) {
    if (rec.durationMs < 1000) {
      error.value = '录音过短，未采集到有效语音，请重新录音。'
      return
    }
    answers[current.value.id] = { rec }
    setAudio(current.value.id, rec)
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
  const result = buildResult(paper, answers)
  saveResult(result)
  navigate('/result')
}

function clearTimers() {
  clearInterval(prepareTimer)
  clearInterval(timer)
  clearTimeout(limitTimer)
}

onUnmounted(() => {
  clearTimers()
  stopAll()
  stopPlayback()
  releaseMic(stream)
  stream = null
})
</script>
