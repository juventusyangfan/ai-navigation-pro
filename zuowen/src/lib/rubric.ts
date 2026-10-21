// 评分规则：prompt 构建、模型输出归一化、合规过滤
//
// 这个文件是整个工具可信度的关键。三条硬规则：
//
// 1. 字数不由模型数。实测让模型「估算篇幅」，它会把 98 字说成「一百五十字左右」，
//    家长一眼就能看出错，整份报告的可信度就没了。所以一律由服务端算准了喂给它。
// 2. 引用的原句必须能在正文里找到。找不到就丢弃这条亮点 —— 宁可少写一条，
//    也不能让报告里出现一句孩子没写过的话。
// 3. 评价字段一律过合规过滤。「提分／排名／最权威／包过」这类词一旦出现，
//    直接换成中性表述或丢弃该条，不做人工兜底。

import { bandOf, type GradeBand } from "./grade";

export type DimKey = "content" | "structure" | "language" | "norm";

export const DIM_MAX: Record<DimKey, number> = {
  content: 30,
  structure: 25,
  language: 30,
  norm: 15,
};

export const DIM_LABEL: Record<DimKey, string> = {
  content: "内容立意",
  structure: "结构条理",
  language: "语言表达",
  // 不叫"书写"：文字粘贴的稿子根本看不出字迹，叫书写会让家长以为在评字写得好不好。
  // 这一维只评错别字、错标点、病句，两种来源都成立。
  norm: "用字规范",
};

export const LEVELS = ["优秀", "良好", "合格", "待提升"] as const;
export type Level = (typeof LEVELS)[number];

/** 只认这 5 类。模型给出「写人记叙文」这种也要归到「写人」。 */
export const GENRES = ["写人", "写事", "写景", "状物", "想象"] as const;
export type Genre = (typeof GENRES)[number];

export type Report = {
  total: number;
  dims: Record<DimKey, number>;
  level: Level;
  genre: Genre | null;
  summary: string;
  highlights: { quote: string; why: string }[];
  advice: { issue: string; how: string }[];
  nextStep: string;
  /** 本篇实际字数（不含标点空白），服务端计算 */
  charCount: number;
  /** 本年级参考区间，用于前端标注"篇幅偏短/偏长" */
  span: [number, number];
  /** 合规过滤留下的痕迹，仅内部可见，不展示给家长 */
  flags: string[];
};

/* ------------------------------------------------------------------ *
 * 字数统计
 * ------------------------------------------------------------------ */

const PUNCT = /[\s，。！？、；：“”‘’（）《》〈〉…—～·,.!?;:"'()[\]{}<>\-—~]/g;

export function charCount(text: string): number {
  return text.replace(PUNCT, "").length;
}

/* ------------------------------------------------------------------ *
 * 识别阶段（仅图片源）
 * ------------------------------------------------------------------ */

export const RECOGNIZE_SYSTEM = `你是小学作文的逐字转录员。用户给你一张孩子手写或打印的作文照片，你只做一件事：把上面的字如实转录下来。

铁律：
1. 保留错别字、错标点、漏字、涂改，一律照原样转录，绝对不要改正、不要润色、不要补全。这些错误本身就是评分依据，改了就等于毁掉评分。
2. 保留原有段落划分，段落之间用一个空行分隔。
3. 不写任何评语、不写「以下是识别结果」之类的话。
4. 只输出 JSON：{"ok":true,"title":"作文题目（没有就给空串）","text":"转录的正文（不含题目）","clarity":"clear|blurry"}
   - 如果图片里根本没有可辨认的文字，输出 {"ok":false,"text":"","clarity":"blurry"}。
   - clarity 只有两种情况：字迹或拍摄基本清楚可辨 = clear；大面积模糊、看不清 = blurry。`;

export function recognizeUserPrompt(): string {
  return "请转录这张图片里的作文。";
}

/* ------------------------------------------------------------------ *
 * 评测阶段
 * ------------------------------------------------------------------ */

export function evaluateSystemPrompt(grade: number): string {
  const b = bandOf(grade);
  return `你是小学语文写作指导老师，正在给一位家长写孩子的作文评测报告。

【本次对象】
${b.label}，${b.focus}。
${b.expectation}。
本年级篇幅参考区间：${b.minChars}—${b.maxChars} 字。

【评分维度，合计 100 分】
- content 内容立意：满分 ${DIM_MAX.content}。写的是不是真事、有没有具体内容、中心是否清楚；
- structure 结构条理：满分 ${DIM_MAX.structure}。分段是否合理、顺序是否清楚、有没有开头结尾；
- language 语言表达：满分 ${DIM_MAX.language}。句子是否通顺、用词是否准确、有没有生动的描写；
- norm 用字规范：满分 ${DIM_MAX.norm}。只评错别字、错标点、明显病句这三样。

【norm 这一维最容易打歪，按这个来】
没有发现错别字、标点错误或病句，就给 12—15 分，不要凭空扣分。
文字粘贴上来的稿子看不出字迹，**不要评价字写得好看不好看**，也不要因为「看不到原件」而扣分。
只有确实指出具体是哪几个字、哪个标点错了，才可以扣到 12 分以下，并在 advice 里说清楚改哪个。

【打分要求】
1. 严格按 ${b.label} 的标准衡量。不要用成年人的眼光，也不要因为「孩子还小」就一律给高分——给高分但说不出好在哪，家长反而不会信。
2. 分数要拉开差距：一篇有明显缺点的作文就应该落在 60—75，不要所有作文都给 80 分以上。
3. 四个维度之和必须等于总分，不要出现总分和分项对不上的情况。
4. 只评写作本身。不提分、不排名、不与其他孩子比较、不承诺任何结果。

【表达要求】
- 全程对家长说话，用「孩子」指代作者，语气平和具体。
- 亮点（highlights）1—2 条，quote 必须从正文里逐字摘一句完整的话，一个字都不能改；why 说清这句话为什么好，要落到写法上（用了什么细节、什么顺序、什么描写）。
- 建议（advice）2 条，按重要性排序。issue 指出具体问题，控制在 50 字以内，不要空泛地说「内容不够丰富」；
  how 给出可照做的改法，控制在 140 字以内，最好带一个示范句子。
  只给最重要的两条 —— 给家长五条改法，等于一条也不会改。
- 每条建议都要是这位家长今晚就能带着孩子动手改的，不要提「多读多写」这种正确但没用的话。
- summary 是一句话总评，不超过 35 个字。
- nextStep 是下一步该练的一个点，一句话，具体到练什么。

只输出 JSON，不要任何多余文字，不要 markdown 代码块：
{"total":0,"dims":{"content":0,"structure":0,"language":0,"norm":0},"genre":"写人|写事|写景|状物|想象","summary":"","highlights":[{"quote":"","why":""}],"advice":[{"issue":"","how":""}],"nextStep":""}`;
}

export function evaluateUserPrompt(args: {
  grade: number;
  title: string;
  text: string;
  charCount: number;
}): string {
  const b = bandOf(args.grade);
  const diff = args.charCount - b.minChars;
  const spanNote =
    diff < 0
      ? `比参考区间少 ${Math.abs(diff)} 字`
      : args.charCount > b.maxChars
        ? `超出参考区间 ${args.charCount - b.maxChars} 字`
        : "在参考区间内";
  return `【作文题目】${args.title || "（未填写）"}
【年级】${b.label}
【实际字数】${args.charCount} 字（已去掉标点与空白，以此为准，不要再自己估算）
【篇幅判断】${spanNote}

【正文】
${args.text}

请按前述要求输出 JSON。genre 只能从「写人、写事、写景、状物、想象」里选一个，判断不出来就整个字段不要输出。`;
}

/* ------------------------------------------------------------------ *
 * 归一化：不信任模型给的任何结构性字段
 * ------------------------------------------------------------------ */

function clampInt(v: unknown, max: number): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(max, Math.round(n)));
}

function levelOf(total: number): Level {
  if (total >= 85) return "优秀";
  if (total >= 70) return "良好";
  if (total >= 60) return "合格";
  return "待提升";
}

function pickGenre(raw: unknown): Genre | null {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s) return null;
  // 「写人记叙文」「记叙文·写事」都要能归位；取第一个命中的类别
  for (const g of GENRES) {
    if (s.includes(g)) return g;
  }
  return null;
}

function cut(s: string, n: number): string {
  const t = s.trim();
  if (t.length <= n) return t;
  // 优先在标点处断开。硬切会把话截在半句（「……现在只用…」），
  // 家长读起来会觉得这个工具很粗糙；找不到合适断点才退化为省略号。
  const head = t.slice(0, n);
  const marks = ["。", "！", "？", "；", "，"];
  let best = -1;
  for (const m of marks) {
    const i = head.lastIndexOf(m);
    if (i > best) best = i;
  }
  if (best >= Math.floor(n * 0.55)) return head.slice(0, best + 1);
  return head.slice(0, n - 1).trimEnd() + "…";
}

/** 去掉引号与空白，用于判断模型引用的句子是否真的出自原文。 */
function flat(s: string): string {
  return s.replace(/[\s“”‘’"'「」『』《》]/g, "");
}

export function normalizeReport(
  raw: any,
  args: { grade: number; text: string; charCount: number },
): Report {
  const flags: string[] = [];
  const dims = {} as Record<DimKey, number>;
  for (const k of Object.keys(DIM_MAX) as DimKey[]) {
    dims[k] = clampInt(raw?.dims?.[k], DIM_MAX[k]);
  }
  // 总分一律按分项相加，不采用模型给的总分，避免两者打架
  const total = (Object.keys(DIM_MAX) as DimKey[]).reduce((s, k) => s + dims[k], 0);

  const summary = filterCompliance(cut(String(raw?.summary ?? ""), 40), "summary", flags);

  const flatText = flat(args.text);
  // 先落到有类型的数组再链式处理：raw 是 any，直接对 any 调 map 会让后续
  // 回调参数失去上下文类型（tsc 报 implicit any）。
  const rawHighlights: unknown[] = Array.isArray(raw?.highlights) ? raw.highlights : [];
  const highlights = rawHighlights
    .map((h: any) => ({
      quote: String(h?.quote ?? "").trim(),
      why: String(h?.why ?? "").trim(),
    }))
    .filter((h) => {
      if (!h.quote || !h.why) return false;
      // 原文里找不到的引用一律丢弃：不让报告出现孩子没写过的话
      return flatText.includes(flat(h.quote));
    })
    .map((h) => ({ quote: h.quote, why: cut(h.why, 120) }))
    .slice(0, 2);

  const rawAdvice: unknown[] = Array.isArray(raw?.advice) ? raw.advice : [];
  const advice = rawAdvice
    .map((a: any) => ({
      issue: String(a?.issue ?? "").trim(),
      how: String(a?.how ?? "").trim(),
    }))
    .filter((a) => a.issue && a.how)
    .map((a) => ({
      issue: filterCompliance(cut(a.issue, 110), "advice", flags),
      how: filterCompliance(cut(a.how, 180), "advice", flags),
    }))
    .filter((a) => a.issue && a.how)
    .slice(0, 2);

  const nextStep = filterCompliance(cut(String(raw?.nextStep ?? ""), 90), "nextStep", flags);

  const b = bandOf(args.grade);
  return {
    total,
    dims,
    level: levelOf(total),
    genre: pickGenre(raw?.genre),
    summary,
    highlights,
    advice,
    nextStep,
    charCount: args.charCount,
    span: [b.minChars, b.maxChars],
    flags,
  };
}

/* ------------------------------------------------------------------ *
 * 合规过滤
 *
 * 这些词一旦出现在对家长说的话里，就等于踩了红线：承诺结果、暗示提分、
 * 与人比较、绝对化表述。作文正文里出现「最」不算问题（「我最喜欢的玩具」
 * 是正常写法），所以只扫评价字段，且只扫模型生成的话。
 * ------------------------------------------------------------------ */

const RULES: { code: string; re: RegExp; safe: string }[] = [
  {
    code: "promise_score",
    re: /(?:提升|提高|涨|增加|多拿|多得|至少)\s*\d+\s*分|提分|涨分|保\s*\d+\s*分|必得\s*\d+\s*分/,
    safe: "可以在具体写法上再下点功夫",
  },
  {
    code: "compare",
    re: /比\s*[^。！？!?\n]{0,10}?(?:更强|更好|更厉害|更优秀|更棒|还强|还好|还差|还弱)|超过\s*\d+\s*%|排名(?:第)?\s*\d+|第\s*一\s*名|打败\s*\d+\s*%/,
    safe: "还可以把细节写得更具体",
  },
  {
    code: "absolute",
    re: /最\s*(?:专业|权威|优质|好用|强|棒|佳|顶级|好)|权威认证|第一品牌|国家级认证|独一无二|包过|保证(?:获奖|考上|通过|提升)/,
    safe: "把这一点写扎实会更有进步",
  },
  {
    code: "exam_link",
    re: /考试(?:能|会|可以)(?:拿|得|考)\s*\d+|升学|加分|评优|择校|中考|高考/,
    safe: "把这一段写清楚，比追求分数更重要",
  },
];

/** 命中即整句换成兜底表述，并记一条 flag。返回空串表示该条应被丢弃。 */
function filterCompliance(text: string, field: string, flags: string[]): string {
  if (!text) return text;
  for (const r of RULES) {
    if (r.re.test(text)) {
      flags.push(`${field}:${r.code}`);
      return r.safe;
    }
  }
  return text;
}

/** 给前端用的兜底文案：模型彻底失败时不至于给家长一片空白。 */
export function fallbackReport(charCount: number, grade: number): Report {
  const b = bandOf(grade);
  return {
    total: 0,
    dims: { content: 0, structure: 0, language: 0, norm: 0 },
    level: "待提升",
    genre: null,
    summary: "",
    highlights: [],
    advice: [],
    nextStep: "",
    charCount,
    span: [b.minChars, b.maxChars],
    flags: ["fallback"],
  };
}
