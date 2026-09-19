<template>
  <div class="page">
    <section v-if="!result" class="card empty">
      <p class="muted">暂无测评结果。</p>
      <button class="btn btn-primary btn-block" @click="navigate('/')">去测评</button>
    </section>

    <template v-else>
      <section class="card score-card">
        <p class="muted small">{{ result.paperTitle }}</p>
        <div class="score">
          <span class="score-num">{{ result.totalScore }}</span>
          <span class="score-max">/ {{ result.maxScore }}</span>
        </div>
        <p class="muted small">
          {{ new Date(result.createdAt).toLocaleString('zh-CN') }}
          <span class="badge">智聆真评</span>
        </p>
      </section>

      <section class="card">
        <h3 class="card-title">能力维度</h3>
        <div v-for="d in result.dimensions" :key="d.key" class="dim">
          <div class="dim-head">
            <span>{{ d.label }}</span>
            <span class="dim-score">{{ d.score }}</span>
          </div>
          <div class="bar">
            <div class="bar-fill" :style="{ width: d.score + '%' }"></div>
          </div>
        </div>
      </section>

      <section class="card">
        <h3 class="card-title">逐题明细</h3>
        <div v-for="s in result.sections" :key="s.id" class="section-block">
          <p class="section-title">
            {{ s.title }}
            <span class="section-score">{{ s.score }} / {{ s.maxScore }}</span>
          </p>
          <div v-for="it in s.items" :key="it.id" class="item-row">
            <div class="item-main">
              <p class="item-title">{{ short(it.title) }}</p>
              <p class="muted small">
                <template v-if="it.type === 'choice'">
                  {{ it.detail.correct ? '回答正确' : '回答错误' }}
                </template>
                <template v-else-if="it.detail.skipped">未作答</template>
                <template v-else>
                  录音 {{ it.detail.durationSec }}s（建议 {{ it.detail.expectedSec }}s）·
                  准确 {{ it.detail.accuracy }} · 流利 {{ it.detail.fluency }} · 完整
                  {{ it.detail.completion }} · 综合 {{ it.detail.suggested }}
                </template>
              </p>
              <div v-if="getAudio(it.id)" class="playback">
                <button class="btn btn-ghost btn-sm" @click="togglePlay(it.id)">
                  {{ playingId === it.id ? '停止' : '试听录音' }}
                </button>
                <span v-if="playingId === it.id && playInfo" class="muted small">
                  {{ playInfo.duration.toFixed(1) }}s<template v-if="playInfo.mode === 'webaudio'"> · 兼容模式</template>
                </span>
                <span v-else-if="!getAudio(it.id)" class="muted small">（刷新后录音不可回放）</span>
              </div>
              <p v-if="playError" class="error small">{{ playError }}</p>
            </div>
            <span class="item-score">{{ it.score }}</span>
          </div>
        </div>
      </section>

      <section class="card">
        <h3 class="card-title">改进建议</h3>
        <div v-for="(s, i) in result.suggestions" :key="i" class="suggest">
          <p class="suggest-title">{{ i + 1 }}. {{ s.title }}</p>
          <p class="muted small">{{ s.body }}</p>
        </div>
      </section>

      <p class="disclaimer">
        本结果为练习反馈，评分引擎与考试阅卷标准不一致，不代表任何考试的预测或实际得分。
      </p>

      <div class="actions">
        <button class="btn btn-ghost" @click="navigate('/')">再测一次</button>
      </div>
    </template>
  </div>
</template>

<script setup>
import { onUnmounted, ref } from 'vue'
import { navigate } from '../router.js'
import { loadResult, getAudio } from '../services/store.js'
import { playRecorded, stopPlayback } from '../services/player.js'

const result = ref(loadResult())
const playingId = ref('')
const playInfo = ref(null)
const playError = ref('')

function short(text) {
  const t = String(text || '')
  return t.length > 42 ? `${t.slice(0, 42)}…` : t
}

async function togglePlay(itemId) {
  if (playingId.value === itemId) {
    stopPlayback()
    playingId.value = ''
    playInfo.value = null
    return
  }
  stopPlayback()
  playingId.value = ''
  playInfo.value = null
  playError.value = ''
  const rec = getAudio(itemId)
  if (!rec) return
  try {
    const info = await playRecorded(rec, () => {
      playingId.value = ''
      playInfo.value = null
    })
    playingId.value = itemId
    playInfo.value = info
  } catch (e) {
    playError.value = '试听失败：浏览器无法播放该录音（' + (e.message || '未知原因') + '）'
  }
}

onUnmounted(() => stopPlayback())
</script>
