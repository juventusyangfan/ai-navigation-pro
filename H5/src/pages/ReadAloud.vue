<template>
  <div class="page">
    <section class="card">
      <h2 class="card-title">模仿朗读 · 智聆真评</h2>
      <p class="muted small">
        单题型最小闭环：官方 JS SDK 内置录音（16k PCM）→ 腾讯云智聆口语评测（新版，段落模式）。
      </p>

      <div class="passage-pick">
        <button
          v-for="p in passages"
          :key="p.id"
          class="chip chip-btn"
          :class="{ active: current.id === p.id }"
          @click="pick(p)"
        >
          {{ p.title }}
        </button>
      </div>

      <div class="passage">{{ current.text }}</div>
      <p class="muted small">
        共 {{ words }} 词（段落模式上限 120 词）· 建议用时 {{ current.suggestSec }}s
      </p>

      <label class="coeff-row">
        <span class="muted small">苛刻指数 score_coeff</span>
        <select v-model.number="scoreCoeff" class="select">
          <option v-for="v in coeffOptions" :key="v" :value="v">{{ v }}</option>
        </select>
      </label>
      <p class="muted small">中学生建议 2.5（1.0 最宽松/幼儿，4.0 最严格/成人），需用本校样本定标。</p>
    </section>

    <section class="card">
      <div class="record-box">
        <p class="record-time">
          {{ statusText }}
          <span v-if="recording"> · {{ elapsed }}s</span>
        </p>

        <button
          v-if="!recording && !evaluating"
          class="btn btn-primary btn-block"
          @click="start"
        >
          {{ result ? '再测一次' : '开始录音' }}
        </button>
        <button v-else-if="recording" class="btn btn-stop btn-block" @click="stop">
          结束录音并提交评测
        </button>
        <button v-else class="btn btn-ghost btn-block" disabled>评测中…</button>
      </div>

      <p v-if="error" class="error">{{ error }}</p>
      <p v-if="credError" class="muted small">{{ credError }}</p>
      <button v-if="credError" class="btn btn-ghost btn-block" @click="loadDemo">
        用模拟数据预览报告（仅验证 UI）
      </button>
    </section>

    <section v-if="result" class="card">
      <h3 class="card-title">评测结果{{ demo ? '（模拟数据）' : '' }}</h3>

      <div v-if="result.noSpeech" class="error">
        未检测到有效语音，本次不计分。请确认麦克风已授权、未被遮挡，朗读声音稍大一些后重录。
      </div>

      <div class="score-row">
        <span class="score-num">{{ result.score5 ?? '--' }}</span>
        <span class="score-max">/ 5 分</span>
        <span class="muted small">综合 {{ result.suggested ?? '--' }} / 100</span>
      </div>
      <p class="muted small">五分制换算：综合分 ÷ 20（0.5 分一档需另行取整）</p>

      <div v-for="d in dims" :key="d.key" class="dim">
        <div class="dim-head">
          <span>{{ d.label }}</span>
          <span class="dim-score">{{ d.value ?? '--' }}</span>
        </div>
        <div class="bar">
          <div class="bar-fill" :style="{ width: (d.value || 0) + '%' }"></div>
        </div>
      </div>

      <div v-if="result.words.length" class="words">
        <p class="keypoints-title">词级明细（红色为未匹配/低分）</p>
        <div class="word-list">
          <span
            v-for="(w, i) in result.words"
            :key="i"
            class="chip"
            :class="{ bad: isBad(w) }"
            :title="w.accuracy == null ? '' : '发音 ' + Math.round(w.accuracy)"
          >
            {{ w.word || '（空）' }}
          </span>
        </div>
      </div>

      <div v-if="audioUrl" class="playback">
        <audio class="player" :src="audioUrl" controls></audio>
      </div>

      <p class="disclaimer">
        智聆返回的是发音层三维分（准确度/流利度/完整度），不含语义与内容评分，也不代表任何考试的预测或实际得分。
      </p>
    </section>

    <div class="actions">
      <button class="btn btn-ghost" @click="navigate('/')">回到完整体验卷</button>
    </div>
  </div>
</template>

<script setup>
import { computed, onUnmounted, ref } from 'vue'
import { navigate } from '../router.js'
import { passages, wordCount } from '../data/readAloudPaper.js'
import { startReadAloud, toWavUrl } from '../services/soeSdk.js'

const coeffOptions = [1.5, 2.0, 2.5, 3.0, 3.5]
const current = ref(passages[0])
const scoreCoeff = ref(2.5)
const recording = ref(false)
const evaluating = ref(false)
const result = ref(null)
const demo = ref(false)
const error = ref('')
const credError = ref('')
const elapsed = ref(0)
const audioUrl = ref('')

const words = computed(() => wordCount(current.value.text))
const statusText = computed(() => {
  if (recording.value) return '录音中…'
  if (evaluating.value) return '已提交，等待智聆返回'
  if (result.value) return '评测完成'
  return '点击开始录音，读完短文后点结束'
})
const dims = computed(() => [
  { key: 'accuracy', label: '发音准确度', value: result.value?.accuracy },
  { key: 'fluency', label: '流利度', value: result.value?.fluency },
  { key: 'completion', label: '完整度', value: result.value?.completion }
])

let ctrl = null
let timer = null

function pick(p) {
  current.value = p
  result.value = null
  demo.value = false
  error.value = ''
}

function isBad(w) {
  if (w.matchTag === 0) return true
  if (w.accuracy != null && w.accuracy < 60) return true
  return false
}

async function start() {
  error.value = ''
  credError.value = ''
  result.value = null
  demo.value = false
  audioUrl.value = ''
  recording.value = true
  elapsed.value = 0
  timer = setInterval(() => (elapsed.value += 1), 1000)

  try {
    ctrl = await startReadAloud({
      refText: current.value.text,
      scoreCoeff: scoreCoeff.value
    })
  } catch (e) {
    recording.value = false
    clearInterval(timer)
    const msg = e.message || String(e)
    // 密钥/服务类问题单独提示，其余当作评测错误
    if (e.isCredential) {
      credError.value = msg + '（页面仍可用模拟数据预览）'
    } else {
      error.value = msg
    }
    ctrl = null
  }
}

async function stop() {
  if (!ctrl) {
    recording.value = false
    return
  }
  clearInterval(timer)
  recording.value = false
  evaluating.value = true
  const c = ctrl
  ctrl = null
  try {
    // 必须先 stop()：它会让 SDK 发出 {"type":"end"} 并停掉录音器。
    // 否则服务端一直等结束信号，永远不返回最终结果（页面卡在「评测中」）。
    c.stop()
    result.value = await c.done
    const url = await toWavUrl(c.getAudio())
    if (url) audioUrl.value = url
  } catch (e) {
    error.value = e.message || String(e)
  } finally {
    evaluating.value = false
  }
}

function loadDemo() {
  demo.value = true
  error.value = ''
  result.value = {
    voiceId: 'demo',
    accuracy: 82.4,
    fluency: 76.1,
    completion: 93.5,
    suggested: 80.2,
    score5: 4.0,
    words: [
      { word: 'Many', ref: 'Many', accuracy: 91, matchTag: 1 },
      { word: 'students', ref: 'students', accuracy: 58, matchTag: 0 },
      { word: 'difficult', ref: 'difficult', accuracy: 74, matchTag: 1 },
      { word: 'practise', ref: 'practise', accuracy: 45, matchTag: 0 }
    ]
  }
}

onUnmounted(() => {
  clearInterval(timer)
  if (ctrl) ctrl.stop()
})
</script>

<style scoped>
.passage-pick {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}
.chip-btn {
  cursor: pointer;
  border: 1px solid var(--line);
  background: #fff;
}
.chip-btn.active {
  background: var(--primary);
  color: #fff;
  border-color: var(--primary);
}
.coeff-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
}
.select {
  padding: 6px 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #fff;
  color: inherit;
}
.score-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 6px 0 2px;
}
.score-num {
  font-size: 34px;
  font-weight: 500;
  color: var(--primary);
}
.score-max {
  color: var(--muted);
  font-size: 14px;
}
.words {
  margin-top: 14px;
}
.word-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}
.chip.bad {
  background: #fdecea;
  color: #c0392b;
}
</style>
