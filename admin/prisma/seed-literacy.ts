// 教AI导航 · AI 通识课（literacy）种子脚本
// 独立运行：npm run db:seed:literacy
// 设计原则：零 deleteMany（绝不误删运营数据），全部 upsert（按 slug 幂等）。
// 仅导入 4 个模块骨架（published）+ 每模块若干课时草稿（draft）。
// 课时 officialUrl 为占位，需编辑在后台核对国家平台真实链接后再发布。
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const json = (v: unknown) => JSON.stringify(v);

// 国家平台《学AI》栏目落地页（占位，编辑核对后替换）
const PLATFORM_BASE = "https://basic.smartedu.cn";

interface LessonSeed {
  slug: string;
  title: string;
  order: number;
  hook: string;
  guideIntro: string;
  watchPoints: string[];
  afterAction: string;
  editorNote?: string;
  officialUrl: string;
  fallbackUrl: string;
  stage?: string;
  durationMin?: number;
  toolSlugs: string[];
}

interface ModuleSeed {
  slug: string;
  num: string;
  title: string;
  summary: string;
  desc: string;
  icon: string;
  goal: string;
  toolSlugs: string[];
  keywords: string[];
  lessons: LessonSeed[];
}

const MODULES: ModuleSeed[] = [
  {
    slug: "what-is-ai",
    num: "一",
    title: "认识人工智能",
    summary: "搞懂 AI 到底是什么、能做什么、不能做什么，建立一线老师的判断力。",
    desc: "本模块帮你把「人工智能」从一个热词变成课堂里用得上的认知工具：它擅长模式识别与生成，不擅长判断对错与承担责任。看完官方原理课，回来用我们的 SOP 把它落到备课与班级管理中。",
    icon: "Brain",
    goal: "能向同事和学生用大白话解释 AI 的能力边界，并识别常见误用。",
    toolSlugs: ["kimi", "doubao", "deepseek"],
    keywords: ["人工智能", "AI原理", "机器学习", "教师AI素养"],
    lessons: [
      {
        slug: "ai-in-one-breath",
        title: "三分钟看懂人工智能是什么",
        order: 0,
        hook: "不用公式，用人话讲清 AI 到底在做什么。",
        guideIntro: "官方课从生活场景切入，讲清楚 AI 是通过大量数据「学规律」再「做预测/生成」的系统。教师视角重点听：它为什么会对、为什么会胡说。",
        watchPoints: ["AI 和人类学习的本质区别在哪？", "为什么它有时候特别准、有时候胡说八道？"],
        afterAction: "打开任一对话工具，让它用一句话解释「什么是人工智能」，对比官方课的讲法。",
        editorNote: "提醒学生：AI 的「自信」不等于「正确」，要核对来源。",
        officialUrl: `${PLATFORM_BASE}/s/xuéAI-what-is-ai`,
        fallbackUrl: `${PLATFORM_BASE}/search?q=人工智能`,
        stage: "通用",
        durationMin: 8,
        toolSlugs: ["kimi", "doubao"],
      },
      {
        slug: "ai-can-and-cant",
        title: "AI 能做什么、不能做什么",
        order: 1,
        hook: "建立边界感，避免把 AI 当万能员工。",
        guideIntro: "官方课盘点了 AI 的典型能力与典型失败。教师视角：重点记「需要负责任/需事实核查」的场景，这些不能交给 AI 独断。",
        watchPoints: ["哪些任务适合直接交给 AI？", "哪些事必须人来拍板？"],
        afterAction: "列一张你本职工作中的任务清单，标注「可委托 AI / 需人审核 / 必须亲为」。",
        officialUrl: `${PLATFORM_BASE}/s/xuéAI-ai-can-cant`,
        fallbackUrl: `${PLATFORM_BASE}/search?q=AI能力边界`,
        stage: "通用",
        durationMin: 10,
        toolSlugs: ["deepseek"],
      },
    ],
  },
  {
    slug: "prompt-basics",
    num: "二",
    title: "与 AI 对话",
    summary: "掌握提示词的基本功：把需求说清楚，AI 才给得对。",
    desc: "本模块教老师写出「能直接用」的提示词：角色、任务、约束、示例四要素。配套 SOP 覆盖备课、出题、评语等高频场景。",
    icon: "ChatCircleText",
    goal: "能独立写出结构清晰、可复用的教学提示词。",
    toolSlugs: ["kimi", "doubao", "wenxin", "tongyi"],
    keywords: ["提示词", "Prompt", "与AI对话", "教学提问"],
    lessons: [
      {
        slug: "prompt-four-parts",
        title: "好提示词的四个零件",
        order: 0,
        hook: "角色+任务+约束+示例，缺一个都容易翻车。",
        guideIntro: "官方课拆解了提示词结构。教师视角：把「你是一个有 10 年经验的班主任」这类角色设定写进去，产出会明显更贴教学语境。",
        watchPoints: ["为什么加角色设定效果更好？", "约束条件怎么写才不矛盾？"],
        afterAction: "用四要素重写一条你常用的备课提示词，对比前后差异。",
        editorNote: "示例（few-shot）对教学类任务尤其有效，给 1-2 个样例。",
        officialUrl: `${PLATFORM_BASE}/s/xuéAI-prompt-basics`,
        fallbackUrl: `${PLATFORM_BASE}/search?q=提示词`,
        stage: "通用",
        durationMin: 12,
        toolSlugs: ["kimi", "wenxin"],
      },
    ],
  },
  {
    slug: "ai-creation",
    num: "三",
    title: "AI 帮我创作",
    summary: "用生成式 AI 做课件、出题、写评语、做素材，把重复劳动交给机器。",
    desc: "本模块覆盖一线最高频的创作场景：PPT、试题、评语、图文素材。每节都接一条本站 SOP，看完就能照着做。",
    icon: "Sparkle",
    goal: "能针对一个具体教学任务，选对工具走完一条 SOP。",
    toolSlugs: ["gamma", "jianying", "canva", "wenku", "kimi"],
    keywords: ["AI创作", "生成式AI", "课件", "出题", "评语"],
    lessons: [
      {
        slug: "ai-make-slides",
        title: "十分钟做出一页能用的课件",
        order: 0,
        hook: "把大纲丢给 AI，再人工把关知识点准确性。",
        guideIntro: "官方课演示用生成式工具产出课件骨架。教师视角：AI 生成的内容必须逐页核对知识点，尤其公式、史实、定义。",
        watchPoints: ["哪些环节必须人工核对？", "怎么让排版更统一？"],
        afterAction: "挑一个明天要讲的难点，用 SOP 生成课件初稿并标注需核实处。",
        officialUrl: `${PLATFORM_BASE}/s/xuéAI-ai-slides`,
        fallbackUrl: `${PLATFORM_BASE}/search?q=AI课件`,
        stage: "通用",
        durationMin: 15,
        toolSlugs: ["gamma", "canva"],
      },
      {
        slug: "ai-make-quiz",
        title: "让 AI 出一份分层练习题",
        order: 1,
        hook: "基础题+提高题一次生成，你只管筛。",
        guideIntro: "官方课讲如何用 AI 按难度分层出题。教师视角：务必人工验证每道题答案与考点匹配，避免「看似合理实则错误」。",
        watchPoints: ["如何让题目覆盖不同难度？", "怎么快速核验答案？"],
        afterAction: "就刚讲完的一节，生成 3 道基础+2 道提高题并批改。",
        editorNote: "AI 出题常见「选项自相矛盾」，发布前务必自测。",
        officialUrl: `${PLATFORM_BASE}/s/xuéAI-ai-quiz`,
        fallbackUrl: `${PLATFORM_BASE}/search?q=AI出题`,
        stage: "通用",
        durationMin: 14,
        toolSlugs: ["kimi", "wenku"],
      },
    ],
  },
  {
    slug: "ai-ethics",
    num: "四",
    title: "AI 伦理与安全",
    summary: "教学生负责任地使用 AI：隐私、版权、学术诚信一个都不能少。",
    desc: "本模块面向教师自身的合规意识，以及面向学生的使用规范。结合本校实际，制定可执行的 AI 使用公约。",
    icon: "ShieldCheck",
    goal: "能向家长和学生讲清 AI 使用的红线与边界。",
    toolSlugs: ["kimi", "doubao"],
    keywords: ["AI伦理", "数据安全", "版权", "学术诚信"],
    lessons: [
      {
        slug: "student-ai-rules",
        title: "给学生定一条 AI 使用公约",
        order: 0,
        hook: "不是禁止，而是教他们用得负责任。",
        guideIntro: "官方课讨论学生使用 AI 的典型风险（代写、隐私泄露、版权）。教师视角：把「哪些作业可用、哪些必须独立完成为」写进班规。",
        watchPoints: ["哪些场景必须独立完成作业？", "怎么保护学生隐私？"],
        afterAction: "起草一页《班级 AI 使用公约》，下周班会讨论通过。",
        editorNote: "涉及未成年人数据，切勿把学生信息喂给公开 AI。",
        officialUrl: `${PLATFORM_BASE}/s/xuéAI-ai-ethics`,
        fallbackUrl: `${PLATFORM_BASE}/search?q=AI伦理`,
        stage: "通用",
        durationMin: 11,
        toolSlugs: ["doubao"],
      },
    ],
  },
];

async function main() {
  console.log("导入 AI 通识课模块与课时（upsert，零删除）…");
  for (const m of MODULES) {
    const mod = await db.litModule.upsert({
      where: { slug: m.slug },
      update: {
        num: m.num,
        title: m.title,
        summary: m.summary,
        desc: m.desc,
        icon: m.icon,
        goal: m.goal,
        toolSlugs: json(m.toolSlugs),
        keywords: json(m.keywords),
        status: "published",
      },
      create: {
        slug: m.slug,
        num: m.num,
        title: m.title,
        summary: m.summary,
        desc: m.desc,
        icon: m.icon,
        goal: m.goal,
        toolSlugs: json(m.toolSlugs),
        keywords: json(m.keywords),
        status: "published",
        order: MODULES.indexOf(m),
      },
    });

    for (const l of m.lessons) {
      await db.litLesson.upsert({
        where: { slug: l.slug },
        update: {
          title: l.title,
          order: l.order,
          hook: l.hook,
          guideIntro: l.guideIntro,
          watchPoints: json(l.watchPoints),
          afterAction: l.afterAction,
          editorNote: l.editorNote ?? null,
          officialUrl: l.officialUrl,
          fallbackUrl: l.fallbackUrl,
          stage: l.stage ?? null,
          durationMin: l.durationMin ?? null,
          status: "draft", // 课时默认草稿，编辑核对真实链接后再发布
        },
        create: {
          moduleId: mod.id,
          slug: l.slug,
          title: l.title,
          order: l.order,
          source: "official",
          officialUrl: l.officialUrl,
          officialProvider: "国家中小学智慧教育平台",
          officialColumn: "学AI",
          stage: l.stage ?? null,
          durationMin: l.durationMin ?? null,
          hook: l.hook,
          guideIntro: l.guideIntro,
          watchPoints: json(l.watchPoints),
          afterAction: l.afterAction,
          editorNote: l.editorNote ?? null,
          faq: json([]),
          keywords: json([]),
          fallbackUrl: l.fallbackUrl,
          status: "draft",
        },
      });
    }
  }

  const [mods, lessons] = await Promise.all([
    db.litModule.count(),
    db.litLesson.count(),
  ]);
  console.log("✅ 通识课种子完成：", { modules: mods, lessons });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
