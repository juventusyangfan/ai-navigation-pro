// 评分服务
// ⚠️ 当前为「本地模拟评分」：不上传音频、不调用任何外部接口，
//    仅基于可测量信号（录音时长与建议时长的比值）生成结构化分数，
//    目的是先把「采集 -> 评分 -> 报告」整条链路跑通。
//    接入腾讯云智聆口语评测（新版）时，只需替换 evaluateSpeech() 的实现（见文件底部 evaluateByServer）。

const clamp = (v, min, max) => Math.max(min, Math.min(max, v))
const clamp01 = (v) => clamp(v, 0, 1)
const round = (v) => Math.round(v)

function hashJitter(seed) {
  let h = 0
  const s = String(seed)
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 100000
  return (h % 13) - 6 // -6 ~ +6 的稳定扰动
}

/** 选择题判分 */
export function evaluateChoice(item, answerIndex) {
  const correct = answerIndex === item.answer
  return { correct, raw: correct ? 100 : 0 }
}

/** 口语题模拟评分：返回与智聆口径一致的三维结构 + 内容分 */
export function evaluateSpeech(item, rec) {
  const sec = rec.durationMs / 1000
  const expected = item.suggestSec || 30
  const ratio = expected > 0 ? sec / expected : 1

  // 时长越接近建议时长，流利度越高；过短按漏读处理
  const completion = clamp01(ratio <= 1 ? 0.55 + 0.45 * ratio : 1 - (ratio - 1) * 0.5)
  const fluency = clamp(1 - Math.abs(1 - ratio) * 0.9, 0.25, 1)
  const base = 58 + 34 * (1 - Math.min(1, Math.abs(1 - ratio)))
  const accuracy = clamp(base + hashJitter(rec.size + rec.durationMs), 0, 100)
  const content = clamp(100 * clamp01(sec / (expected * 0.75)), 0, 100)

  return {
    accuracy: round(accuracy),
    fluency: round(fluency * 100),
    completion: round(completion * 100),
    content: round(content),
    durationSec: Math.round(sec * 10) / 10,
    expectedSec: expected,
    mock: true
  }
}

function scoreSpeech(item, m) {
  const weights =
    item.type === 'read_aloud'
      ? { accuracy: 0.6, fluency: 0.2, completion: 0.2 }
      : item.type === 'dialogue'
        ? { accuracy: 0.5, fluency: 0.2, content: 0.3 }
        : { accuracy: 0.4, fluency: 0.15, content: 0.45 }
  return (
    m.accuracy * weights.accuracy +
    m.fluency * weights.fluency +
    (weights.completion ? m.completion * weights.completion : m.content * weights.content)
  )
}

/** 汇总整卷结果 */
export function buildResult(paper, answers) {
  const sections = []
  const speechMetrics = []
  const contentMetrics = []
  const choiceRates = []
  const readMetrics = []

  paper.sections.forEach((section) => {
    const items = []
    section.items.forEach((item) => {
      const maxScore = section.score / section.items.length
      const ans = answers[item.id]
      let score = 0
      let detail = null

      if (section.type === 'choice') {
        const r = evaluateChoice(item, ans && ans.choiceIndex)
        choiceRates.push(r.correct ? 1 : 0)
        score = (r.raw / 100) * maxScore
        detail = { correct: r.correct, answer: ans && ans.choiceIndex }
      } else {
        if (ans && ans.rec) {
          const m = evaluateSpeech({ ...item, type: section.type }, ans.rec)
          speechMetrics.push(m)
          if (section.type === 'read_aloud') readMetrics.push(m)
          if (section.type === 'dialogue' || section.type === 'retell') contentMetrics.push(m)
          score = (scoreSpeech({ ...item, type: section.type }, m) / 100) * maxScore
          detail = { ...m, sizeKb: Math.round(ans.rec.size / 1024) }
        } else {
          detail = { skipped: true }
        }
      }

      items.push({
        id: item.id,
        type: section.type,
        title: item.question || item.passage || section.title,
        score: Math.round(score * 10) / 10,
        maxScore,
        detail
      })
    })
    sections.push({
      id: section.id,
      title: section.title,
      score: Math.round(items.reduce((s, i) => s + i.score, 0) * 10) / 10,
      maxScore: section.score,
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
      score: round(avg(readMetrics.length ? readMetrics : speechMetrics, 'completion'))
    },
    { key: 'content', label: '要点覆盖', score: round(avg(contentMetrics, 'content')) }
  ]

  const totalScore = Math.round(sections.reduce((s, x) => s + x.score, 0) * 10) / 10

  return {
    id: `r_${Date.now()}`,
    paperId: paper.id,
    paperTitle: paper.title,
    totalScore,
    maxScore: paper.totalScore,
    createdAt: new Date().toISOString(),
    engine: 'mock',
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

/**
 * 接入真实评测引擎的替换点（暂未启用）
 *
 * 腾讯云智聆口语评测（新版）为 WSS 流式协议，签名必须由服务端签发，
 * 因此生产环境应：H5 -> 自建服务端(/api/eval) -> 智聆 WSS，禁止在前端暴露 SecretKey。
 * 服务端返回 { accuracy, fluency, completion, content, words: [] } 结构后，
 * 把 evaluateSpeech 换成 evaluateByServer 即可，其余报告逻辑无需改动。
 */
export async function evaluateByServer(item, rec) {
  const base = import.meta.env.VITE_API_BASE || ''
  if (!base) throw new Error('未配置 VITE_API_BASE，暂不支持服务端评测')
  const form = new FormData()
  form.append('itemId', item.id)
  form.append('type', item.type)
  form.append('refText', item.passage || item.audioText || '')
  form.append('audio', rec.blob, `${item.id}.${rec.mime.includes('mp4') ? 'mp4' : 'webm'}`)
  const res = await fetch(`${base}/api/eval`, { method: 'POST', body: form })
  if (!res.ok) throw new Error(`评测失败: ${res.status}`)
  return res.json()
}
