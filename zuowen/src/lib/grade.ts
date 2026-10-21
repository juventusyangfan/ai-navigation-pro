// 小学各年级的写作基准
//
// 为什么要有这张表：同一个分数，放在一年级是「写得不错」，放在六年级就是「明显偏弱」。
// 不把年级基准喂给模型，它会用一套笼统的成人标准打分，家长一眼就能看出不对。
// 字数区间取自课标与教材通行要求，是「参考区间」而非硬性及格线，
// prompt 里明确说了不要因为没到字数就直接扣重分。

export type GradeBand = {
  grade: number;
  /** 展示用名称 */
  label: string;
  /** 篇幅参考区间（字），用于提示模型该看多少字 */
  minChars: number;
  maxChars: number;
  /** 该年级最该关注的能力点，直接拼进 prompt */
  focus: string;
  /** 该年级允许的最低成篇要求（低于此值的处理方式） */
  expectation: string;
};

export const GRADE_BANDS: GradeBand[] = [
  {
    grade: 1,
    label: "一年级",
    minChars: 30,
    maxChars: 100,
    focus: "能写出一两句完整通顺的话，愿意用文字表达，标点基本会用句号和问号",
    expectation: "一年级只看句子是否完整、意思是否说得清，不要求分段成篇，不要拿篇章结构去扣分",
  },
  {
    grade: 2,
    label: "二年级",
    minChars: 80,
    maxChars: 180,
    focus: "能围绕一件事写出几句话，句子通顺，能用上简单的标点",
    expectation: "二年级开始尝试成段表达，能看出先后顺序即可，不苛求开头结尾",
  },
  {
    grade: 3,
    label: "三年级",
    minChars: 180,
    maxChars: 280,
    focus: "段落分明，能把一件事写清楚，开始有细节和简单的外貌、动作描写",
    expectation: "三年级是成篇的起点，重点看「有没有把一件事说明白」，允许语言朴素",
  },
  {
    grade: 4,
    label: "四年级",
    minChars: 280,
    maxChars: 380,
    focus: "内容具体，能按顺序把事情写完整，有初步的详略意识",
    expectation: "四年级要求内容具体，避免只写经过梗概，鼓励写清看到、听到、心里想的",
  },
  {
    grade: 5,
    label: "五年级",
    minChars: 380,
    maxChars: 480,
    focus: "中心明确，能围绕中心选材，叙事有起伏，开始有自己的感受和看法",
    expectation: "五年级要求围绕一个中心选材，能删掉与中心无关的内容",
  },
  {
    grade: 6,
    label: "六年级",
    minChars: 450,
    maxChars: 600,
    focus: "详略得当，表达有个人特点，能综合运用描写、抒情，结尾有提升",
    expectation: "六年级要求详略分明、有真情实感，避免流水账和空泛抒情",
  },
];

export function bandOf(grade: number): GradeBand {
  return GRADE_BANDS.find((b) => b.grade === grade) ?? GRADE_BANDS[2];
}

export function isGrade(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 6;
}
