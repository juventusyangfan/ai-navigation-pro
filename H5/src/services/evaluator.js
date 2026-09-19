// 评分服务（真评版）
//
// 口语题评分已切换为腾讯云智聆口语评测（新版）Web SDK 的真实结果，
// 由 src/services/soeSdk.js 在录音时直连 wss://soe.cloud.tencent.com 评测，
// 本文件只负责「汇总报告」。
//
// 智聆仅返回发音层三维分（准确度 / 流利度 / 完整度），不评语义与内容。
// 情景交际 / 信息转述这类考要点的题型，内容分需业务侧另建 ASR + LLM 量规，
// 此处不计内容分（维度"要点覆盖"显示为 0，属真实情况，不作假）。

const clamp = (v, min, max) => Math.max(min, Math.min(max, v))
const round = (v) => Math.round(v)

/** 选择题判分 */
export function evaluateChoice(item, answerIndex) {
  const correct = answerIndex === item.answer
  return { correct, raw: correct ? 100 : 0 }
}

// 口语题权重：智聆只给发音层三维，不做内容权重。
// 模仿朗读偏完整度，情景交际 / 信息转述偏完整度（内容分由业务侧另算，本层不计）。
function scoreSpeech(type, m) {
  const weights =
    type === 'read_aloud'
      ? { accuracy: 0.6, fluency: 0.2, completion: 0.2 }
      : type === 'dialogue'
        ? { accuracy: 0.5, fluency: 0.2, completion: 0.3 }
        : { accuracy: 0.4, fluency: 0.15, completion: 0.45 }
  return (
    m.accuracy * weights.accuracy +
    m.fluency * weights.fluency +
    m.completion * weights.completion
  )
}

/** 汇总整卷结果 */
export function buildResult(paper, answers) {
  const sections = []
  const speechMetrics = []
  const readMetricsList = []
  const choiceRates = []

  paper.sections.forEach((section) => {
    const items = []
    const sectionScore = section.score
    section.items.forEach((item) => {
      const maxScore = sectionScore / section.items.length
      const ans = answers[item.id]
      let score = 0
      let detail = null

      if (section.type === 'choice') {
        const r = evaluateChoice(item, ans && ans.choiceIndex)
        choiceRates.push(r.correct ? 1 : 0)
        score = (r.raw / 100) * maxScore
        detail = { correct: r.correct, answer: ans && ans.choiceIndex }
      } else {
        // 口语题：必须已通过智聆 SDK 完成评测（answers[id].soe 为真实结果）
        if (ans && ans.soe) {
          const s = ans.soe
          const m = { accuracy: s.accuracy, fluency: s.fluency, completion: s.completion }
          speechMetrics.push(m)
          if (section.type === 'read_aloud') readMetricsList.push(m)
          score = (scoreSpeech(section.type, m) / 100) * maxScore
          detail = {
            soe: true,
            accuracy: s.accuracy,
            fluency: s.fluency,
            completion: s.completion,
            content: null, // 智聆不评内容/语义
            suggested: s.suggested,
            score5: s.score5,
            durationSec: Math.round((ans.rec ? ans.rec.durationMs : 0) / 1000),
            expectedSec: item.suggestSec,
            words: s.words || []
          }
        } else {
          detail = { skipped: true }
        }
      }

      items.push({
        id: item.id,
        type: section.type,
        title: item.question || item.passage || item.audioText || section.title,
        score: Math.round(score * 10) / 10,
        maxScore,
        detail
      })
    })
    sections.push({
      id: section.id,
      title: section.title,
      score: Math.round(items.reduce((s, i) => s + i.score, 0) * 10) / 10,
      maxScore: sectionScore,
      items
    })
  })

  const avg = (arr, key) => (arr.length ? arr.reduce((s, m) => s + m[key], 0) / arr.length : 0)

  const dimensions = [
    {
      key: 'listening',
      label: '听力理解',
      score: round(choiceRates.length ? (choiceRates.reduce((a, b) => a + b, 0) / choiceRates.length) * 100 : 0)
    },
    { key: 'accuracy', label: '发音准确度', score: round(avg(speechMetrics, 'accuracy')) },
    { key: 'fluency', label: '表达流利度', score: round(avg(speechMetrics, 'fluency')) },
    {
      key: 'completion',
      label: '完整度',
      score: round(avg(readMetricsList.length ? readMetricsList : speechMetrics, 'completion'))
    },
    { key: 'content', label: '要点覆盖', score: 0 } // 智聆不评内容，需业务侧另建量规
  ]

  const totalScore = Math.round(sections.reduce((s, x) => s + x.score, 0) * 10) / 10

  return {
    id: `r_${Date.now()}`,
    paperId: paper.id,
    paperTitle: paper.title,
    totalScore,
    maxScore: paper.totalScore,
    createdAt: new Date().toISOString(),
    engine: 'soe', // 真实评测引擎标识
    sections,
    dimensions,
    suggestions: buildSuggestions(dimensions)
  }
}

/** 规则化改进建议：全部由分数触发，不做自由发挥（防幻觉 / 防投诉） */
export function buildSuggestions(dimensions) {
  const get = (k) => (dimensions.find((d) => d.key === k) || {}).score || 0
  const list = []

  if (get('accuracy') > 0 && get('accuracy') < 70) {
    list.push({
      title: '先纠音，再求快',
      body: '发音准确度偏低。每天用 5 分钟慢速跟读短文，把 th / v / l / r 等易错音单独拆出来练，宁慢勿错。'
    })
  }
  if (get('fluency') > 0 && get('fluency') < 70) {
    list.push({
      title: '按意群连读，别逐词蹦',
      body: '流利度偏低。朗读时按意群停顿（一个意群一口气读完），用同一篇短文计时重读 3 遍，看语速是否稳定。'
    })
  }
  if (get('completion') > 0 && get('completion') < 80) {
    list.push({
      title: '避免漏读吞词',
      body: '完整度偏低。录音前先通读一遍短文，遇到长单词提前拆分音节，宁可稍慢也不要跳词。'
    })
  }
  if (get('content') > 0 && get('content') < 70) {
    list.push({
      title: '转述用「五问法」抓要点',
      body: '要点覆盖不足。听录音时用 Who / When / Where / What / Why 五个问题做速记，转述时按这五问逐一说全。'
    })
  }
  if (get('listening') > 0 && get('listening') < 70) {
    list.push({
      title: '补听力输入，不只是练口语',
      body: '听力理解偏弱。先做听记训练（听一句写关键词），再做跟读，避免「听不懂所以答不出」。'
    })
  }
  if (!list.length) {
    list.push({
      title: '状态不错，保持节奏',
      body: '各维度均在及格线以上。建议每周保持 3 次跟读 + 1 次完整模考，重点维持流利度与完整度。'
    })
  }
  return list
}
