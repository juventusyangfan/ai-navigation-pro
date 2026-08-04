// 教AI导航 · 全站单一数据源
// 由原型 design/generate.js 移植，所有页面均从此处取数。

export type Role = "老师" | "学生" | "家长" | "学校管理员";
export type Pricing = "Free" | "Freemium" | "Paid" | "Enterprise";
export type Level = "入门" | "进阶" | "熟练";

export interface Cat {
  icon: string;
  phase: string;
  desc: string;
}

export interface Scene {
  key: string;
  name: string;
  cat: string;
  icon: string;
  roles: Role[];
}

export interface Step {
  /** 这一步要达到的目标 / 意图（先懂为什么再做） */
  goal?: string;
  /** 动作描述 */
  action: string;
  /** 可直接复制的提示词，写死的具体内容用 {{变量}} 占位 */
  prompt: string;
  /** 示例产出：一小段脱敏的真实 AI 返回样例，让用户知道“做成什么样算对” */
  outputSample: string;
  media?: { type: "image" | "video" | "file"; label: string };
  /** 避坑：常见错误 / 合规红线（红框） */
  pitfall?: string;
  /** 技巧：正向提效建议（绿框） */
  tip?: string;
  /** 决策分支：遇到某情况时建议怎么走（紫框） */
  branch?: { when: string; then: string }[];
}

export interface Path {
  title: string;
  /** 一句话摘要，显示在路径卡上，帮用户快速判断要不要点 */
  summary?: string;
  /** 预计耗时（分钟） */
  estMinutes?: number;
  /** 难度：入门 / 进阶 / 熟练 */
  level?: Level;
  /** 适用角色 */
  forRole?: Role;
  /** 关联的用法库条目 id（打通社会证明与互链） */
  usageId?: string;
  steps: Step[];
}

export interface Tool {
  slug: string;
  name: string;
  logo: string;
  color: string;
  tagline: string;
  url: string;
  roles: Role[];
  scenes: string[];
  subjects: string[];
  pricing: Pricing;
  platform: string;
  rating: number;
  pros: string[];
  cons: string[];
  compliance: string;
  alts: string[];
  paths: Path[];
}

export interface Usage {
  id: string;
  title: string;
  scene: string;
  role: Role;
  subj: string;
  tool: string;
  toolName?: string;
  pick: boolean;
  useful: number;
  collect: number;
  steps: number;
  summary: string;
}

/* ---------------- 分类（教学全流程） ---------------- */
export const CATS: Record<string, Cat> = {
  教学准备: { icon: "Compass", phase: "课前", desc: "上课前：备课规划、资源搜集与课堂导入设计" },
  课堂教学: { icon: "PaintBrush", phase: "课中", desc: "在课堂：课件制作、综合实践与课堂互动生成" },
  评价协同: { icon: "ChartBar", phase: "课后", desc: "下课后：作业考试、学情评价与家校沟通协同" },
  成长教研: { icon: "BookOpen", phase: "发展", desc: "长期成长：自学答疑、教研课题与专业发展" },
};

/* ---------------- 8 个教学场景 ---------------- */
export const SCENES: Scene[] = [
  { key: "beikeguihua", name: "备课规划", cat: "教学准备", icon: "Notepad", roles: ["老师"] },
  { key: "kejian", name: "课件制作", cat: "课堂教学", icon: "PaintBrush", roles: ["老师"] },
  { key: "zuoye", name: "作业考试", cat: "评价协同", icon: "ClipboardText", roles: ["老师", "学生"] },
  { key: "xueqing", name: "学情评价", cat: "评价协同", icon: "ChartLineUp", roles: ["老师", "家长"] },
  { key: "jiaxiao", name: "家校班级", cat: "评价协同", icon: "ChatsCircle", roles: ["老师", "家长"] },
  { key: "zixue", name: "自学答疑", cat: "成长教研", icon: "BookOpen", roles: ["学生", "老师"] },
  { key: "keti", name: "教研课题", cat: "成长教研", icon: "Flask", roles: ["老师", "学生"] },
  { key: "shijian", name: "综合实践", cat: "课堂教学", icon: "PuzzlePiece", roles: ["老师", "学生"] },
];

export const SCENE_NAME: Record<string, string> = Object.fromEntries(
  SCENES.map((s) => [s.key, s.name]),
);

/* ---------------- 12 个工具 ---------------- */
export const TOOLS: Tool[] = [
  {
    slug: "doubao",
    name: "豆包",
    logo: "豆",
    color: "#2f6bff",
    tagline: "字节跳动出品的中文全能 AI 助手",
    url: "https://doubao.com",
    roles: ["老师", "学生", "家长"],
    scenes: ["beikeguihua", "kejian", "jiaxiao", "zuoye"],
    subjects: ["综合"],
    pricing: "Freemium",
    platform: "网页 / APP / 插件",
    rating: 4.6,
    pros: ["中文语感自然", "支持语音对话", "免费额度充足"],
    cons: ["长文易跑题", "学科深度有限"],
    compliance: "请勿上传含学生真实姓名、肖像的隐私内容；建议学校统一开通教育版账号并制定使用规范。",
    alts: ["deepseek", "glm"],
    paths: [
      {
        title: "用豆包做课堂导入（配图）",
        summary: "情境提问 + AI 配图，3 分钟搞定一节课的开场。",
        estMinutes: 8,
        level: "入门",
        forRole: "老师",
        usageId: "u1",
        steps: [
          {
            goal: "用贴近生活的情境把学生带进课文，并拿到可直接生图的画面描述",
            action: "让豆包生成情境化导入语 + 生图描述",
            prompt:
              "你是一名{{学段学科}}老师，请为{{课文}}设计一段约 2 分钟的课堂导入：先抛一个贴近学生生活的问题，再给出可用于 AI 生图的画面描述（含构图与色调）。",
            outputSample:
              "导入语：「同学们，你们眼中的春天是什么样子的？是楼下草地冒出的第一抹绿，还是窗外悄然攀上的藤蔓……」\n生图描述：暖色调田野，远处淡青山峦，近景一枝初绽的桃花，光影柔和，适合投屏。",
            media: { type: "image", label: "课堂导入配图示意（AI 生成）" },
            tip: "提示词先写「角色 + 任务 + 约束」，豆包更听话；把 {{课文}} 换成这周要讲的篇目即可整套复用。",
          },
          {
            goal: "把文字描述变成可投屏的画面",
            action: "把生图描述丢进生图工具出图并投屏",
            prompt: "",
            outputSample: "一张可直接投屏的导入配图（建议用即梦 / 妙鸭等生图工具，按上面的描述生成）。",
            pitfall: "避免生成带具体校名、班牌的图片，防止信息泄露。",
            tip: "投屏前用班级大屏预览一次，确认分辨率与配色适合后排观看。",
          },
        ],
      },
      {
        title: "用豆包写家校班级话术",
        summary: "先肯定孩子再提建议，生成温和得体的家校沟通话术。",
        estMinutes: 5,
        level: "入门",
        forRole: "老师",
        steps: [
          {
            goal: "先肯定孩子，再温和地传递需改进的信息，语气不伤人",
            action: "说明学生情况与沟通目的",
            prompt:
              "请以班主任口吻，给一位{{学科}}作业连续缺交的学生家长写一段微信：先肯定孩子优点，再委婉说明情况并给出可执行的改进建议，语气温和。",
            outputSample:
              "（示例）XX 妈妈好，XX 最近课堂上思考很积极，这点特别好；不过数学作业已连续两次未交，想和您一起帮孩子把节奏找回来——建议每天放学先完成一科作业再玩，有问题随时找我。",
            pitfall: "涉及学生负面评价时注意措辞，并保留沟通记录。",
            tip: "把「先肯定后建议」的结构固定下来，同类沟通只需替换学生姓名与学科，能大幅提速。",
          },
        ],
      },
    ],
  },
  {
    slug: "deepseek",
    name: "DeepSeek",
    logo: "DS",
    color: "#4d6bfe",
    tagline: "深度推理大模型，擅长逻辑与解题",
    url: "https://deepseek.com",
    roles: ["老师", "学生"],
    scenes: ["zuoye", "xueqing", "keti", "zixue"],
    subjects: ["数学"],
    pricing: "Free",
    platform: "网页 / APP / API",
    rating: 4.7,
    pros: ["推理能力强", "完全免费", "支持长上下文"],
    cons: ["高峰期易繁忙", "中文润色稍弱"],
    compliance: "出题涉及考试公平，建议仅用于日常练习与复习，不用于正式测验原题生成。",
    alts: ["kimi", "tongyi"],
    paths: [
      {
        title: "用 DeepSeek 出一套初三数学期中卷",
        summary: "细目表 → 分层命题 → 评分标准，附合规卷首语，一次出齐。",
        estMinutes: 25,
        level: "进阶",
        forRole: "老师",
        usageId: "u2",
        steps: [
          {
            goal: "先定结构与难度分布，避免想到哪出到哪",
            action: "明确范围与难度，生成双向细目表",
            prompt:
              "你是{{年级}}{{学科}}备课组长。请按{{章节列表}}，出一份{{考试名称}}双向细目表：题型、分值、难度（易:中:难=6:3:1）、对应知识点。",
            outputSample:
              "细目表（节选）：选择题 10×3=30 分（易 6 / 中 3 / 难 1）；填空 4×4=16 分……知识点覆盖：一元二次方程 30%、二次函数 40%、旋转 15%、圆 15%。",
            media: { type: "file", label: "期中卷命题细目表.md" },
            tip: "先让模型输出细目表再出题，能避免知识点重复；难度比例可按班级实际调整。",
            branch: [
              { when: "时间紧，想先发练习", then: "只做步骤 1 + 2（细目表 + 基础题）即可先发" },
              { when: "班级基础偏弱", then: "把难度比例调到 易:中:难 = 7:2:1" },
            ],
          },
          {
            goal: "先稳住基础分，保证知识点覆盖面",
            action: "按细目表生成基础题",
            prompt: "基于上面的细目表，先生成「容易」档的 12 道选择题与 4 道填空题，附答案与解析要点。",
            outputSample: "Q1 …… 答案：C。解析：考查一元二次方程根的判别，Δ>0 有两不等实根……",
            tip: "基础题占比最大，务必逐题核对答案，这步错了后面全错。",
          },
          {
            goal: "拉开区分度，并给出可操作的评分尺度",
            action: "生成中档与压轴题",
            prompt: "再生成 4 道中等解答题（含过程分步骤）和 1 道压轴综合题，给出评分标准。",
            outputSample:
              "解答题 3：…… 评分：步骤①2 分、②3 分、③3 分、结论 2 分，共 10 分。",
            pitfall: "务必人工核对答案与知识点覆盖，避免超纲或重复。",
            tip: "压轴题要求学生写完整过程，评分标准按步骤给分更公平。",
          },
          {
            goal: "补一段合规说明，守住考试公平底线",
            action: "生成卷首语与合规说明",
            prompt: "写一段卷首语，提醒学生诚信作答、本卷仅用于阶段练习。",
            outputSample:
              "卷首语：本卷为{{年级}}{{学科}}{{考试名称}}阶段练习，请诚信独立作答；如有疑问课后答疑，勿在考场交流。",
            media: { type: "file", label: "试卷卷首语（合规）.md" },
            tip: "卷首语用中性、鼓励的措辞，别写成批评。",
          },
        ],
      },
      {
        title: "用 DeepSeek 做错题归因",
        summary: "粘贴错题即可拿到错因分析与同类变式题，讲评更高效。",
        estMinutes: 6,
        level: "入门",
        forRole: "老师",
        steps: [
          {
            goal: "找到错在哪、为什么错，并给同类题巩固",
            action: "粘贴错题请其归因",
            prompt: "下面是一道学生常错的{{知识点}}题，请分析典型错误原因，并给出 2 道同类变式题用于巩固。",
            outputSample:
              "典型错因：把{{知识点}}的符号规则记反，导致……变式 1：…… 变式 2：……（均附答案与易错点提示）。",
            tip: "粘贴错题时连「学生的错误答案」一起给，归因才准。",
          },
        ],
      },
    ],
  },
  {
    slug: "glm",
    name: "智谱 GLM",
    logo: "GLM",
    color: "#7c3aed",
    tagline: "国产大模型，文档与 Agent 能力强",
    url: "https://zhipuai.cn",
    roles: ["老师", "学生"],
    scenes: ["keti", "beikeguihua", "xueqing"],
    subjects: ["综合"],
    pricing: "Freemium",
    platform: "网页 / API",
    rating: 4.5,
    pros: ["长文档处理稳", "工具调用成熟", "支持智能体"],
    cons: ["免费额度有限", "界面偏专业"],
    compliance: "上传课题资料时注意脱敏；生成的申报书需人工把关学术规范。",
    alts: ["kimi", "deepseek"],
    paths: [
      {
        title: "用 GLM 写课题申报书框架",
        summary: "标准框架 + 逐节扩写，课题申报书骨架一次成型。",
        estMinutes: 20,
        level: "进阶",
        forRole: "老师",
        usageId: "u9",
        steps: [
          {
            goal: "先有骨架再填肉，避免结构遗漏",
            action: "给研究方向让其列框架",
            prompt:
              "我正在申报一项{{级别}}课题：{{课题名称}}。请输出申报书标准框架（问题提出、文献综述、研究目标、内容、方法、创新点、预期成果）。",
            outputSample:
              "一、问题提出：…… 二、文献综述：…… 三、研究目标：…… 四、研究内容：…… 五、研究方法：…… 六、创新点：…… 七、预期成果：……（七节完整骨架）。",
            pitfall: "框架仅为脚手架，核心论点须由教师原创。",
            tip: "框架出来后，先把「创新点」想清楚再扩写，避免后期返工。",
          },
          {
            goal: "逐节落地，便于专家审阅",
            action: "逐节扩写并校验",
            prompt: "请就「研究目标」一节扩写 300 字，语言学术化、可考核。",
            outputSample:
              "研究目标：构建{{学科}}{{主题}}的评价框架，形成可复制的校本案例 3 个，发表相关论文 1 篇。",
            tip: "扩写时给明确字数（如 300 字）和语气（学术化），输出更可控。",
          },
        ],
      },
    ],
  },
  {
    slug: "kimi",
    name: "Kimi",
    logo: "Ki",
    color: "#0ea5e9",
    tagline: "超长上下文，擅长读文献与整理",
    url: "https://kimi.moonshot.cn",
    roles: ["老师", "学生"],
    scenes: ["keti", "zixue", "xueqing"],
    subjects: ["综合"],
    pricing: "Freemium",
    platform: "网页 / APP",
    rating: 4.6,
    pros: ["长文档碾压", "摘要精准", "联网检索"],
    cons: ["深度推理一般", "高峰期限速"],
    compliance: "上传文献注意版权；引用须核对原文页码。",
    alts: ["glm", "deepseek"],
    paths: [
      {
        title: "用 Kimi 整理长篇文献",
        summary: "上传 PDF 出结构化卡片，多篇对比即可写综述。",
        estMinutes: 15,
        level: "进阶",
        forRole: "老师",
        usageId: "u6",
        steps: [
          {
            goal: "把一篇长文压缩成可复用、能直接进课件的知识卡片",
            action: "上传 PDF 让其做结构化摘要",
            prompt:
              "请阅读这篇论文，输出：①研究问题 ②方法 ③主要结论 ④可迁移到{{学段}}教学的 3 个启示。用表格呈现。",
            outputSample:
              "研究问题：…… 方法：…… 主要结论：…… 教学启示1：…… 启示2：…… 启示3：……",
            tip: "用表格输出便于直接粘进文献管理工具；{{学段}}换成你教的学生群体。",
          },
          {
            goal: "把多篇结论汇成综述雏形",
            action: "对比多篇提炼综述",
            prompt: "把上面{{篇数}}篇摘要对比，找出共识与分歧，帮我起草一段文献综述。",
            outputSample:
              "三篇文献在{{主题}}上共识为……；分歧在于……；综合来看，建议……（综述段初稿）。",
            pitfall: "综述观点需回到原文核对，勿直接照搬生成文本。",
            tip: "综述段务必回原文核对，AI 可能把不同文献的观点混在一起。",
          },
        ],
      },
    ],
  },
  {
    slug: "mistral",
    name: "秘塔写作猫",
    logo: "秘",
    color: "#0d9488",
    tagline: "中文纠错与润色，批改好帮手",
    url: "https://xiezuocat.com",
    roles: ["老师"],
    scenes: ["zuoye"],
    subjects: ["综合"],
    pricing: "Freemium",
    platform: "网页 / 插件",
    rating: 4.4,
    pros: ["错别字捕捉强", "润色自然", "批改高效"],
    cons: ["创意弱", "长文需分段"],
    compliance: "仅处理教学文本，勿让学生作文原文外传至公共网络。",
    alts: ["doubao", "wenxin"],
    paths: [
      {
        title: "用秘塔写作猫润色评语",
        summary: "把生硬草稿改成具体、有鼓励性的作业评语。",
        estMinutes: 4,
        level: "入门",
        forRole: "老师",
        usageId: "u5",
        steps: [
          {
            goal: "把生硬草稿改成具体、有鼓励性的评语",
            action: "粘贴学生作业评语草稿",
            prompt: "（在写作猫中粘贴）请把这段评语改得更具体、更有鼓励性，保留「{{要点}}」的要点。",
            outputSample:
              "原：作业完成一般。\n改：你的计算步骤完整、书写工整，尤其第 3 题的思路很清晰；若能把符号细节再留心，会更出色。",
            pitfall: "保留教师个人信息与判断，AI 只做语言优化。",
            tip: "把「要保留的要点」用 {{要点}} 标出，AI 就不会把你的判断改掉。",
          },
        ],
      },
    ],
  },
  {
    slug: "bishun",
    name: "笔神",
    logo: "笔",
    color: "#db2777",
    tagline: "面向学生的 AI 作文辅导",
    url: "https://bishun.com",
    roles: ["学生", "老师"],
    scenes: ["zuoye", "zixue"],
    subjects: ["语文"],
    pricing: "Freemium",
    platform: "网页 / APP",
    rating: 4.3,
    pros: ["作文思路引导", "素材推荐", "批改反馈"],
    cons: ["需防代写", "部分功能付费"],
    compliance: "应设置“启发而非代写”模式，避免学生直接复制成文。",
    alts: ["doubao", "kimi"],
    paths: [
      {
        title: "用笔神改一篇作文",
        summary: "启发式批改指出问题与方向，保护原创而非代写。",
        estMinutes: 7,
        level: "入门",
        forRole: "学生",
        usageId: "u7",
        steps: [
          {
            goal: "启发修改而非代写，保护原创能力",
            action: "提交作文获取批改",
            prompt: "（在笔神中提交）请指出这篇{{文体}}的结构问题与 3 处可优化的描写，并给修改建议，不要直接重写。",
            outputSample:
              "结构问题：开头铺垫过长，建议 2 句切入。\n可优化描写①第 2 段：…… 建议加一处感官细节。\n（共 3 处，均给修改方向，未替写。）",
            pitfall: "产品须引导「改」而非「替写」，保护原创能力。",
            tip: "用「指出问题 + 给方向」而非「重写」，才能真正提升写作能力。",
          },
        ],
      },
    ],
  },
  {
    slug: "gamma",
    name: "Gamma",
    logo: "G",
    color: "#f59e0b",
    tagline: "一句话生成精美演示文稿",
    url: "https://gamma.app",
    roles: ["老师"],
    scenes: ["kejian"],
    subjects: ["综合"],
    pricing: "Freemium",
    platform: "网页",
    rating: 4.5,
    pros: ["排版惊艳", "生成快", "可导出 PPT"],
    cons: ["中文偶有瑕疵", "需联网"],
    compliance: "课件中勿出现真实学生信息；导出后请人工核对事实。",
    alts: ["canva", "kejian"],
    paths: [
      {
        title: "用 Gamma 把大纲变课件",
        summary: "输入章节大纲，一键生成可导出 PPT 的精美课件。",
        estMinutes: 10,
        level: "入门",
        forRole: "老师",
        usageId: "u3",
        steps: [
          {
            goal: "从大纲直接拿到版式初稿，省去排版",
            action: "输入章节大纲生成",
            prompt:
              "基于《{{章节}}》一节的教学大纲（概念、证明、例题、应用），生成一套 {{页数}} 页教学课件，风格简洁学术。",
            outputSample:
              "第1页 封面：{{章节}}；第2页 概念；第3页 证明；第4页 例题；……（共 {{页数}} 页，含版式与配图占位）。",
            media: { type: "image", label: "Gamma 课件排版示意" },
            tip: "先给清晰大纲，Gamma 排版才不跑偏；{{页数}} 建议 12–16 页一节为宜。",
          },
          {
            goal: "拿到可分发、可二次编辑的文件",
            action: "调整并导出为 PPT",
            prompt: "",
            outputSample: "可下载的 .pptx 模板（含版式、字体与占位图，导出后按需替换）。",
            media: { type: "file", label: "{{章节}}课件模板.pptx" },
            pitfall: "导出后务必核对例题答案与版式错乱。",
            tip: "导出 PPT 后，重点核对例题答案与图表来源。",
          },
        ],
      },
    ],
  },
  {
    slug: "canva",
    name: "Canva",
    logo: "C",
    color: "#e11d48",
    tagline: "海量模板的视觉设计工具",
    url: "https://canva.com",
    roles: ["老师", "学生"],
    scenes: ["kejian"],
    subjects: ["综合"],
    pricing: "Freemium",
    platform: "网页 / APP",
    rating: 4.4,
    pros: ["模板极多", "易上手", "协作方便"],
    cons: ["AI 能力弱于专用", "高级素材付费"],
    compliance: "使用正版素材；学生作品注意肖像权。",
    alts: ["gamma", "jianying"],
    paths: [
      {
        title: "用 Canva 做课堂海报",
        summary: "选教育模板改文字，快速出一张可张贴的活动海报。",
        estMinutes: 6,
        level: "入门",
        forRole: "老师",
        steps: [
          {
            goal: "快速出一张能直接张贴/群发的活动海报",
            action: "选教育模板改文字",
            prompt: "（在 Canva 中）搜索「{{海报主题}}」模板，替换为{{活动信息}}。",
            outputSample:
              "海报设计稿：标题{{活动名称}}、时间{{时间}}、地点{{地点}}、二维码位预留，配色沿用模板。",
            tip: "搜索模板时用「校园 / 活动」关键词，比从空白做起快 5 倍。",
          },
        ],
      },
    ],
  },
  {
    slug: "jianying",
    name: "剪映",
    logo: "剪",
    color: "#111827",
    tagline: "全民易用的视频剪辑与 AI 成片",
    url: "https://capcut.cn",
    roles: ["老师"],
    scenes: ["shijian"],
    subjects: ["综合"],
    pricing: "Free",
    platform: "APP / 桌面",
    rating: 4.5,
    pros: ["免费", "字幕/配音自动化", "模板多"],
    cons: ["精细控制弱", "水印（免费）"],
    compliance: "微课中不得出现未成年学生正面特写而不经授权。",
    alts: ["canva", "gamma"],
    paths: [
      {
        title: "用剪映做一节微课",
        summary: "图文成片 + 字幕精修，零基础产出短视频微课。",
        estMinutes: 15,
        level: "进阶",
        forRole: "老师",
        usageId: "u4",
        steps: [
          {
            goal: "把讲稿变成带配音的初剪，省去录屏",
            action: "用「图文成片」生成初剪",
            prompt: "（剪映 AI）把《{{课题}}》讲解稿生成带配音的短视频初稿。",
            outputSample: "微课初稿：约 {{时长}} 的短视频，自动字幕 + 配音，画面按讲稿分段。",
            media: { type: "video", label: "《{{课题}}》微课演示" },
            tip: "讲稿分段写、每段配一句画面提示，成片更顺。",
            branch: [
              { when: "还没有写讲稿", then: "先用豆包 / 通义把《{{课题}}》讲稿整理成段落，再回来生成" },
            ],
          },
          {
            goal: "核对术语，精修成片",
            action: "加字幕与转场精修",
            prompt: "",
            outputSample: "成片：字幕逐句校准、转场统一、片头片尾补齐。",
            pitfall: "AI 配音可能念错术语，逐句核对字幕。",
            tip: "AI 配音易念错专业术语，务必逐句听一遍字幕。",
          },
        ],
      },
    ],
  },
  {
    slug: "wenxin",
    name: "文心一言",
    logo: "文",
    color: "#2563eb",
    tagline: "百度大模型，中文知识广",
    url: "https://yiyan.baidu.com",
    roles: ["老师", "学生"],
    scenes: ["jiaxiao", "zuoye", "keti"],
    subjects: ["综合"],
    pricing: "Freemium",
    platform: "网页 / APP",
    rating: 4.3,
    pros: ["知识面广", "插件丰富", "国产化"],
    cons: ["深度推理一般", "长文偶散"],
    compliance: "家校班级话术需教师把关；学生内容注意适龄。",
    alts: ["doubao", "glm"],
    paths: [
      {
        title: "用文心一言拟家长通知",
        summary: "填活动时间地点议程，一次生成正式亲切的家长通知。",
        estMinutes: 5,
        level: "入门",
        forRole: "老师",
        steps: [
          {
            goal: "正式又不生硬地把关键信息一次说清",
            action: "给出活动信息生成通知",
            prompt:
              "请写一则{{活动名称}}通知：时间{{时间}}、地点{{地点}}、议程含{{议程项}}，语气正式亲切。",
            outputSample:
              "通知：各位家长好，定于{{时间}}在{{地点}}召开{{活动名称}}，议程包括{{议程项}}。敬请拨冗参加，如有疑问联系班主任。",
            tip: "议程项列清楚，家长一眼就知道要准备什么。",
          },
        ],
      },
    ],
  },
  {
    slug: "tongyi",
    name: "通义千问",
    logo: "通",
    color: "#0891b2",
    tagline: "阿里大模型，答疑与多模态",
    url: "https://tongyi.aliyun.com",
    roles: ["学生", "老师"],
    scenes: ["zixue", "beikeguihua"],
    subjects: ["英语"],
    pricing: "Free",
    platform: "网页 / APP",
    rating: 4.4,
    pros: ["免费", "多模态", "英文强"],
    cons: ["复杂推理一般"],
    compliance: "英语口语练习建议学生自主使用，教师定期检查使用记录。",
    alts: ["kimi", "deepseek"],
    paths: [
      {
        title: "用通义做英语答疑",
        summary: "讲思路不讲答案，引导真正理解而非直接抄。",
        estMinutes: 8,
        level: "入门",
        forRole: "学生",
        usageId: "u8",
        steps: [
          {
            goal: "讲清思路而非直接给答案，引导真正理解",
            action: "拍照/输入题目求讲解",
            prompt: "请讲解这道{{题型}}的解题思路，并标注涉及的语法点，不要只给答案。",
            outputSample:
              "思路：先判断本句缺少{{句子成分}}，再结合时态锁定{{语法点}}……语法点：{{语法点}}的用法是……",
            pitfall: "引导学生理解而非直接抄答案。",
            tip: "要求学生「讲思路不讲答案」，可顺带让模型出 1 道同类题自测。",
            branch: [
              { when: "学生基础弱", then: "追加「多给 2 个例句并放慢解释」" },
              { when: "临近考试", then: "追加「按中考真题风格再出 3 题自测」" },
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "wenku",
    name: "文库 AI",
    logo: "库",
    color: "#475569",
    tagline: "百度文库 AI，资料与总结",
    url: "https://wenku.baidu.com",
    roles: ["老师", "学生"],
    scenes: ["beikeguihua", "zuoye"],
    subjects: ["综合"],
    pricing: "Freemium",
    platform: "网页",
    rating: 4.2,
    pros: ["资料库大", "总结快", "可出题"],
    cons: ["质量参差", "部分付费"],
    compliance: "引用资料需标注来源；注意版权与适龄。",
    alts: ["kimi", "doubao"],
    paths: [
      {
        title: "用文库 AI 汇总备课资料",
        summary: "零散资料压成备课要点：重点、难点、活动设计。",
        estMinutes: 10,
        level: "入门",
        forRole: "老师",
        steps: [
          {
            goal: "把零散资料压成可直接用的备课要点",
            action: "上传/检索资料生成摘要",
            prompt: "请基于检索到的《{{课文或主题}}》教学资料，生成一份 {{时长}} 备课要点（重点、难点、活动设计）。",
            outputSample:
              "备课要点：重点——{{重点}}；难点——{{难点}}；活动——分组探究{{主题}}，用时约 {{活动时长}}。",
            pitfall: "资料真实性需教师核实，勿盲目采信。",
            tip: "检索词加上「教学设计 / 重难点」，资料质量更高。",
          },
        ],
      },
    ],
  },
];

export const TOOL_MAP: Record<string, Tool> = Object.fromEntries(
  TOOLS.map((t) => [t.slug, t]),
);

export const USAGES: Usage[] = [
  { id: "u1", title: "用豆包生成课堂导入（配图）", scene: "beikeguihua", role: "老师", subj: "综合", tool: "doubao", pick: true, useful: 128, collect: 64, steps: 2, summary: "情境提问 + AI 配图，3 分钟搞定一节课的开场。" },
  { id: "u2", title: "用 DeepSeek 出一套初三数学期中卷", scene: "zuoye", role: "老师", subj: "数学", tool: "deepseek", pick: true, useful: 256, collect: 131, steps: 4, summary: "细目表 → 分层命题 → 评分标准，附合规卷首语。" },
  { id: "u3", title: "用 Gamma 把大纲变课件", scene: "kejian", role: "老师", subj: "综合", tool: "gamma", pick: false, useful: 92, collect: 47, steps: 2, summary: "输入章节大纲，一键生成可导出 PPT 的精美课件。" },
  { id: "u4", title: "用剪映做一节微课", scene: "shijian", role: "老师", subj: "综合", tool: "jianying", pick: false, useful: 73, collect: 39, steps: 2, summary: "图文成片 + 字幕精修，零基础产出短视频。" },
  { id: "u5", title: "用秘塔写作猫润色评语", scene: "zuoye", role: "老师", subj: "综合", tool: "mistral", pick: false, useful: 58, collect: 22, steps: 1, summary: "把生硬草稿改成具体、鼓励性评语。" },
  { id: "u6", title: "用 Kimi 整理长篇文献", scene: "keti", role: "老师", subj: "综合", tool: "kimi", pick: true, useful: 141, collect: 70, steps: 2, summary: "上传 PDF 出结构化卡片，多篇对比写综述。" },
  { id: "u7", title: "用笔神帮学生改作文", scene: "zixue", role: "学生", subj: "语文", tool: "bishun", pick: false, useful: 64, collect: 28, steps: 1, summary: "启发式批改，保护原创而非代写。" },
  { id: "u8", title: "用通义千问做英语答疑", scene: "zixue", role: "学生", subj: "英语", tool: "tongyi", pick: false, useful: 88, collect: 41, steps: 1, summary: "讲思路不讲答案，引导真正理解。" },
  { id: "u9", title: "用智谱 GLM 写课题申报书", scene: "keti", role: "老师", subj: "综合", tool: "glm", pick: false, useful: 77, collect: 35, steps: 2, summary: "标准框架 + 逐节扩写，学术规范需把关。" },
];

/* ---------------- 角色 ---------------- */
export const ROLES: Role[] = ["老师", "学生", "家长", "学校管理员"];

export function roleClass(r: Role): "teacher" | "student" | "parent" | "admin" {
  return r === "老师"
    ? "teacher"
    : r === "学生"
      ? "student"
      : r === "家长"
        ? "parent"
        : "admin";
}

/* ---------------- Helper ---------------- */
export function getTool(slug: string): Tool | undefined {
  return TOOL_MAP[slug];
}
export function getScene(key: string): Scene | undefined {
  return SCENES.find((s) => s.key === key);
}
export function getUsage(id: string): Usage | undefined {
  return USAGES.find((u) => u.id === id);
}
export function toolsByScene(key: string): Tool[] {
  return TOOLS.filter((t) => t.scenes.includes(key));
}
export function usagesForScene(key: string): Usage[] {
  return USAGES.filter((u) => u.scene === key);
}
export function usagesForTool(slug: string): Usage[] {
  return USAGES.filter((u) => u.tool === slug);
}
export function pricingLabel(p: Pricing): string {
  return p === "Free"
    ? "免费"
    : p === "Freemium"
      ? "免费+增值"
      : p === "Paid"
        ? "付费"
        : "企业版";
}

export const CAT_ORDER = Object.keys(CATS);
