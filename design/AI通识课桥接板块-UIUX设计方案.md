# AI通识课桥接板块 · UI/UX 设计方案

> 设计师：颜好看 ｜ 类型：已上线站点的板块增量设计（不重做品牌）
> 基线：`front/src/app/globals.css`（Claymorphism Design System, Style #9）
> 图标系统：`front/src/lib/icons.tsx` → Phosphor Icons，统一 `<Icon name="..." size={} />`

---

## 0. 摸底结论：这个站现在的设计语言是什么

在动笔前我通读了 `globals.css`（3482 行）、`/literacy`、`/usages`、`/usages/[id]`、`/tool/[slug]`、`layout.tsx`、`Header`、`BottomNav`、`CopyButton`、`SopPathView`、`FeedbackBox`、`content.ts`、`icons.tsx` 与原型稿 `design/ailiteracy.html`。结论如下，新板块必须长在这套语言里：

**风格身份**：Claymorphism（软 3D 黏土风）。三个不可动摇的特征——
1. **厚边框**：卡片 `3px`，控件 `2.5px`，标签 `2px`。这是全站最强的视觉签名，比阴影更能定义"这是教AI导航"。
2. **大圆角**：`--radius-card: 20px`、`--radius-btn: 16px`。
3. **内外双向阴影**：`--shadow-clay = inset -2px -2px 6px rgba(0,0,0,.04), 3px 3px 6px rgba(0,0,0,.06)`，hover 升 `--shadow-clay-lg`，按下 `--shadow-clay-press`。

**色彩身份**：teal 主色（`#0D9488`）+ 极浅青底（`#F0FDFA`）+ 深墨青文字（`#134E4A`）。**不是** Indigo，不是紫。新板块沿用，不引入第二品牌色。

**排版身份**：标题 Nunito（800/900 字重，`--font-heading`）、正文 DM Sans（`--font-body`）、编号与提示词块 JetBrains Mono（`--font-mono`）。中文回退 PingFang SC / Microsoft YaHei。三种字体已在 `layout.tsx` 用 `next/font/google` 注入并绑定同名 CSS 变量，**新板块不得再引字体**。

**内容页范式（伴学页必须与之同构）**：`/tool/[slug]` 与 `/usages/[id]` 已经确立了一套成熟骨架——
`.crumb`（面包屑）→ `.detail-head`（大卡片头：标题 + `.detail-tagline` + 标签行 + `.detail-actions` 动作行）→ `.grid-2`（`1fr 300px` 主副栏，≤1024px 塌成单列）→ 主栏 `.card` + `.card h3 > .dot`，副栏 `.card.aside-card`。
**伴学页照抄这套骨架**，只换填充物。这是"无缝长进去"最省力也最可靠的路径。

---

## 1. 信息架构与页面层级

### 1.1 三层职责

| 层 | 路由 | 回答老师的哪个问题 | 页面性格 |
|---|---|---|---|
| **落地页** | `/literacy` | "这里到底有啥？跟我有啥关系？我从哪开始？" | 索引 + 定位声明 + 分诊台 |
| **模块页** | `/literacy/[module]` | "这一块讲什么？有几节？学完我能干嘛？" | 学习清单 + 完成感 |
| **伴学页** | `/literacy/[module]/[lesson]` | "这节课值不值得我花 15 分钟？看完我练什么？" | 导学 + 转化 |

### 1.2 模块页要不要独立存在——我的判断：**要，但必须是"可绕过的"**

先说反对意见的分量：多插一层点击必然掉转化率，且如果模块页只是"课时列表"，它就是 SEO 眼里的薄内容页，反噬站点权重。这个担心是对的。

但三条硬理由压过它：

1. **路由完整性是硬约束**。既然拍板了 `/literacy/[module]/[lesson]`，那 `/literacy/[module]` 被访问是必然的——用户会截断 URL、爬虫会试探、面包屑会指过去。它要么是一个真页面，要么是一个 404。没有第三种。
2. **"上一课/下一课"需要一个作用域宿主**。跨模块连续翻页在认知上是错的（从"伦理红线"直接翻到"学科应用"没有连贯性）。翻页必须锁在模块内，模块就必须是一个一等公民。
3. **中段搜索词只有模块页能接**。老师搜的是"教师 AI 伦理 培训""提示词 怎么写 老师"这种模块粒度的词，落地页太泛、伴学页太细，中间这层正好。

**但它不能成为闸门**。设计上做两件事让它可绕过：
- **落地页的模块卡直接摊开课时清单**（前 3 节），老师可以从落地页一步直达任意伴学页，不必经过模块页；
- **模块页不做纯列表**，加三样只有它能承载的东西：`模块导语（本站视角）`、`学完这个模块你能做的 3 件事`、`本模块全部可下载资产`。这样它对人有用、对搜索引擎也不薄。

一句话：**模块页是"可选的深度页"，不是"必经的中转站"。**

### 1.3 导航网（谁能到谁）

```
                      Header 全局导航「AI通识课」
                      BottomNav「通识」tab（移动端）
                               │
                               ▼
   ┌──────────────────── /literacy 落地页 ────────────────────┐
   │  · 模块卡 → 模块页                                        │
   │  · 模块卡内课时行 ─────────────────────────┐（跳过模块页） │
   │  · 「你现在卡在哪儿」分诊行 ───────────────┤             │
   └───────────────────┬───────────────────────┼─────────────┘
                       ▼                       ▼
        /literacy/[module] 模块页 ──────▶ /literacy/[module]/[lesson]
                       ▲                    │   │   │
                       │ 面包屑 / 返回本模块  │   │   └─▶ 官方平台（新窗口，站外）
                       └─────────────────────┘   │
                                                 ├─▶ /usages/[id]  站内 SOP（转化核心）
                                                 ├─▶ /tool/[slug]  工具页
                                                 └─▶ 上一课 / 下一课（锁在模块内）
```

**面包屑规则**（复用 `.crumb`，与 `/usages/[id]` 完全一致的写法）：
- 模块页：`AI通识课 / 提示词基础`（末级为 `<b>` 不可点，与 `/tool/[slug]` 第 54 行同款）
- 伴学页：`AI通识课 / 提示词基础 / 三段式提示词`
- 移动端 ≤640px 面包屑只保留最后两级 + 一个左箭头返回，避免折行占两行。

**BottomNav 高亮已经天然正确**：`BottomNav.tsx` 第 23-25 行用 `pathname.startsWith(tab.href)` 判活，所以 `/literacy/*` 任意深度都会点亮「通识」tab，**无需改动 BottomNav**。这一条我已在代码里核实。

---

## 2. 页面 A：`/literacy` 落地页

### 2.1 要解决的问题

老页面（现 `page.tsx`）说的是"我们有一套四模块课程"。新定位是"官方讲原理、我们配练习"。**这句话必须在首屏说完，而且要说得像人话，不能像 slogan。**

我拒绝用"大标题 + 大按钮 + 抽象图形"的 Hero。取而代之的是一个**信息密实的配对条**：把"两方各出什么"直接摆成两块并排的实体，中间一个箭头。老师扫一眼就懂，不需要读完一段文案。

### 2.2 区块顺序与线框

```
┌─ .wrap ───────────────────────────────────────────────────────────┐
│                                                                    │
│ ┌ .rel-banner ─────────────────────────────────────────────────┐  │
│ │ <Icon GraduationCap 14/> AI通识课 是「国家平台的课 + 本站的     │  │
│ │ 动手练」；只想找工具去 全部场景→ ；只想抄步骤去 用法库→        │  │
│ └──────────────────────────────────────────────────────────────┘  │
│                                                     ↕ 16px         │
│ ┌ .lit-hero（改造：去掉渐变文字）─────────────────────────────┐    │
│ │ h1  AI通识课 · 导学                                         │    │
│ │ p   课不是我们讲的。原理课在国家中小学智慧教育平台上，官方、  │    │
│ │     免费、有视频；我们做的是给每节课配一句"你为什么要看"、   │    │
│ │     一段本土化点评，和看完就能上手的分步 SOP。               │    │
│ │ .lit-stats  [BookOpen 5个模块] [PlayCircle 18节官方课]      │    │
│ │             [ListNumbers 24条配套SOP] [FileText 6份可下模板] │    │
│ └─────────────────────────────────────────────────────────────┘    │
│                                                     ↕ 24px         │
│ ┌ .lit-bridge ★新增 ──────────────────────────────────────────┐   │
│ │  这门课不是我们讲的                                          │   │
│ │ ┌─ .lit-bridge-side ─────┐  →  ┌─ .lit-bridge-side.is-ours ┐│   │
│ │ │ <Icon Bank 20/>         │     │ <Icon Wrench 20/>         ││   │
│ │ │ 国家中小学智慧教育平台   │     │ 教AI导航（本站）           ││   │
│ │ │ 讲「是什么 / 为什么」    │     │ 给「打开就能做」的步骤     ││   │
│ │ │ 官方 · 免费 · 有视频     │     │ 24 条 SOP · 一线老师亲测   ││   │
│ │ │ basic.smartedu.cn ↗     │     │ 每节课都配好了            ││   │
│ │ └────────────────────────┘     └───────────────────────────┘│   │
│ │  下面每一节，都是「官方课 + 我们配的动手练」的一对             │   │
│ └─────────────────────────────────────────────────────────────┘   │
│                                                     ↕ 48px         │
│ ┌ section.block ─ 你现在卡在哪儿？（.lit-entry ★新增）────────┐   │
│ │ .sec-head  h2 你现在卡在哪儿？ / sub 直接跳到对症的那一节     │   │
│ │ ─────────────────────────────────────────────────────────── │   │
│ │  完全没碰过，怕在课堂上说错话   模块一·1 大模型到底是什么  →  │   │
│ │ ─────────────────────────────────────────────────────────── │   │
│ │  会用，但它老是答非所问        模块二·1 三段式提示词      →  │   │
│ │ ─────────────────────────────────────────────────────────── │   │
│ │  学生数据能不能喂给 AI，我心里没底 模块三·1 隐私红线      →  │   │
│ │ ─────────────────────────────────────────────────────────── │   │
│ │  下周就开学，我要能直接用的东西  模块五 开学急救包(5份模板) → │   │
│ └─────────────────────────────────────────────────────────────┘   │
│                                                     ↕ 48px         │
│ ┌ section.block ─ 课程路径（.lit-mods 改造）──────────────────┐   │
│ │ .sec-head h2 课程路径 / sub 五个模块，从建立预期到开学能用   │   │
│ │                                                              │   │
│ │ ┌ .lit-mod（保留现有卡片外壳）────────────────────────────┐ │   │
│ │ │ [.lit-num 二] 提示词基础                                │ │   │
│ │ │              学会把需求说清楚：角色+任务+约束…           │ │   │
│ │ │ ┌ .lit-mod-lessons ★新增 ─────────────────────────────┐│ │   │
│ │ │ │ 1  三段式提示词  [官方课] 15分 · 配2条SOP          → ││ │   │
│ │ │ │ 2  给示例、给格式、逐步迭代 [官方课] 12分 · 配1条  → ││ │   │
│ │ │ │ 3  常见翻车现场与修正      [本站]  8分 · 配3条    → ││ │   │
│ │ │ │ ─────────────────────────────────────────────────  ││ │   │
│ │ │ │ 还有 1 节 · 看整个模块 →                            ││ │   │
│ │ │ └────────────────────────────────────────────────────┘│ │   │
│ │ │ .lit-row [相关工具] (chip-link) DeepSeek↗ 智谱GLM↗     │ │   │
│ │ └────────────────────────────────────────────────────────┘ │   │
│ │  × 5 个模块，纵向堆叠（.lit-mods 已是 column + gap:16px）   │   │
│ └─────────────────────────────────────────────────────────────┘   │
│                                                     ↕ 48px         │
│ ┌ section.block ─ 可以直接拿走的模板（复用 .att）─────────────┐   │
│ │  6 张 .att 横条，两列网格；每张 = 图标 + 名称 + 格式大小 +   │   │
│ │  [复制全文] (CopyButton 复用) / [下载 PDF] (.dl)            │   │
│ └─────────────────────────────────────────────────────────────┘   │
│                                                     ↕ 48px         │
│ ┌ section.block ─ 本路径相关工具（.tool-grid 原样保留）───────┐   │
│ └─────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────┘
```

### 2.3 留白节奏（全部沿用现有值，不发明新间距）

- 区块之间：`section.block { padding: 48px 0 }`（globals.css:619-621，原样用）
- 卡片内边距：`.lit-mod` 现为 `22px 24px`，课时清单加入后**不改 padding**，靠 `.lit-mod-lessons` 自身 `margin-top: 14px` + `border-top: 2px solid var(--color-border)` 分隔
- 模块卡之间：`.lit-mods` 已有 `gap: 16px`
- `.lit-bridge` 内部：外层 padding `24px`，两块之间 `gap: 16px`
- `.lit-entry` 每行 `padding: 14px 4px` + `border-bottom: 2px solid var(--color-border)`，最后一行去边框

### 2.4 三处关键设计决策

**① `.lit-hero h1` 必须去掉渐变文字。**
现有 globals.css:1717-1720 给 `.lit-hero h1` 上了 `linear-gradient(120deg, primary, violet)` + `background-clip:text`。两个问题：一是渐变文字在小屏 + 中文粗笔画下可读性明显下降；二是 teal→violet 的跨色相渐变是全站唯一一处，与其他页面（`/scenes` `/usages` 的纯色 h1）不一致，本来就是个孤例。既然这一页要重写，顺手统一成 `color: var(--color-text)`，强调靠 Nunito 900 字重和字号，不靠颜色。

**② "你现在卡在哪儿"不做成卡片网格。**
三张等宽卡片配图标是最容易滑向 AI 模板的形态。这里改成**分隔线列表**：左边是老师的原话（"会用，但它老是答非所问"），右边是目标课名，整行可点。信息密度更高，也更像一个真的分诊台而不是一个 landing page section。移动端左右两段折成上下两行，行高保持 ≥48px。

**③ 课时行上的来源标记用文字不用色块。**
`[官方课]` / `[本站]` 两个标记，用 `.lit-tag-src` 小标签（12px、`--font-mono`、`--color-muted`、`1.5px` 细边框、透明底）。**不给"官方课"任何特殊颜色**——一旦给它蓝色或金色，就开始有"认证徽章"的味道，那是本方案第 6 节明确要避免的。它只是一个中性的来源事实，不是一个荣誉。

---

## 3. 页面 B：`/literacy/[module]` 模块页

性格：**学习清单 + 完成感**。不承载课程正文，承载"这一块的全貌"。

```
┌─ .wrap.py-8 ──────────────────────────────────────────────────────┐
│ .crumb   AI通识课 / 提示词基础                                     │
│                                                                    │
│ ┌ .detail-head（复用 tool 详情页头卡）────────────────────────┐   │
│ │ [.lit-num-lg 二]   h1 提示词基础                             │   │
│ │  (56×56)          .detail-tagline                            │   │
│ │                    AI 答非所问，九成是需求没说清。这一块教你  │   │
│ │                    把脑子里的要求，翻译成 AI 听得懂的话。     │   │
│ │                   .tag 行: [4节课] [3节官方] [配6条SOP]      │   │
│ │                            [1份模板] [约50分钟]              │   │
│ │                   .detail-actions:                           │   │
│ │                     [从第1节开始 →] btn-primary              │   │
│ │                     [看这个模块的模板] btn-ghost             │   │
│ └──────────────────────────────────────────────────────────────┘   │
│                                                     ↕ 24px         │
│ ┌ .grid-2（1fr 300px）─────────────────────────────────────────┐  │
│ │ ┌ 主栏 ────────────────────────────┐ ┌ 副栏 aside ────────┐ │  │
│ │ │ .card                             │ │ .card.aside-card   │ │  │
│ │ │  h3 <.dot> 学完这个模块，你能——    │ │  h3 <.dot> 其他模块 │ │  │
│ │ │  <Icon CheckCircle 16/> 把"帮我出  │ │  一 什么是AI    →  │ │  │
│ │ │    份卷子"改写成 AI 真能执行的指令 │ │ ▸二 提示词基础(当前)│ │  │
│ │ │  <Icon CheckCircle 16/> 看出 AI 在 │ │  三 伦理与安全  →  │ │  │
│ │ │    编，并知道怎么让它别编          │ │  四 学科应用    →  │ │  │
│ │ │  <Icon CheckCircle 16/> 用一套模板 │ │  五 开学急救包  →  │ │  │
│ │ │    应付备课/评语/通知三类活         │ └────────────────────┘ │  │
│ │ ├───────────────────────────────────┤ ┌ .card.aside-card ──┐ │  │
│ │ │ .card                             │ │ h3 <.dot> 合规提示 │ │  │
│ │ │  h3 <.dot> 4 节课                  │ │ .compliance        │ │  │
│ │ │  ┌ .lit-lessons（复用 .sop-timeline│ │ <Icon ShieldCheck> │ │  │
│ │ │  │  竖线 + .step-num 编号方块）───┐│ │ 课程正文在国家平台 │ │  │
│ │ │  │ [1] 三段式提示词        [官方] ││ │ 本站只做导学，不代 │ │  │
│ │ │  │  │  为什么看：你现在写的提示   ││ │ 表官方观点         │ │  │
│ │ │  │  │  词，AI 只能猜。这节课给你  ││ └────────────────────┘ │  │
│ │ │  │  │  一个填空式框架。           ││ ┌ .card.aside-card ──┐ │  │
│ │ │  │  │  15分 · 视频 · 配2条SOP  → ││ │ h3 <.dot> 用到的工具│ │  │
│ │ │  │ [2] 给示例、给格式      [官方] ││ │ (复用 .alt-tool 行) │ │  │
│ │ │  │  │  …                     →   ││ │ DeepSeek / 智谱GLM │ │  │
│ │ │  │ [3] 常见翻车现场        [本站] ││ └────────────────────┘ │  │
│ │ │  │ [4] 把模糊需求改写清楚  [官方] ││                        │  │
│ │ │  └────────────────────────────────┘│                        │  │
│ │ ├───────────────────────────────────┤                        │  │
│ │ │ .card h3 <.dot> 这个模块的模板     │                        │  │
│ │ │  .att 《万能提示词模板（填空版）》  │                        │  │
│ │ │       [复制全文] [下载 PDF]        │                        │  │
│ │ ├───────────────────────────────────┤                        │  │
│ │ │ .card h3 <.dot> 本模块关联的 6 条SOP│                       │  │
│ │ │  .pb-grid（复用用法库卡片，2列）    │                        │  │
│ │ └───────────────────────────────────┘                        │  │
│ └───────────────────────────────────────────────────────────────┘ │
│                                                     ↕ 24px         │
│ ┌ .lit-nav（横向，两端对齐）───────────────────────────────────┐  │
│ │ ← 上一模块 · 什么是 AI          下一模块 · AI伦理与安全 →     │  │
│ └───────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────┘
```

**为什么课时清单复用 `.sop-timeline` 的视觉**：SOP 详情页（`SopPathView`）用"竖线 + 编号方块"表达"这是有先后顺序的一串步骤"（globals.css:2716-2731、`.step-num` 2419-2431）。模块内的课时同样有先后。复用同一套视觉，等于告诉老熟人"这里也是一条要走完的线"，零学习成本。只有一处差异：课时行的编号方块用 `.step-num` 原样（`--color-primary-soft` 底 + mono 字），但整行是链接，hover 时 `border-color: var(--color-border-strong)` —— 与 `.lit-mod:hover` 同一个反馈语言。

---

## 4. 页面 C：`/literacy/[module]/[lesson]` 伴学页 —— 核心矛盾的解法

### 4.1 先把矛盾说清楚

要求是"既要诚实地把用户送去官方看课，又要让他看完回来练 SOP"。

多数人会本能地把外链按钮做小、做灰、藏在下面，用视觉手段拖住用户。**这是错的，而且会反噬**：老师点不到课，会认为这站是个骗流量的空壳，一次就走。这个板块的全部价值建立在"诚实转介"上，一旦诚实感垮了，SOP 也没人练。

所以我的策略是反过来的：**把外链做得非常显眼、非常好点，但在时间轴上把它包夹起来。**

### 4.2 三段式包夹结构（这是本页的骨架）

```
        ①看之前                    ②看的时候              ③看完之后
   ┌────────────────┐         ┌──────────────┐       ┌──────────────┐
   │ 为什么要看这节  │         │  用户在官方   │       │ 回访条 + SOP  │
   │ 3个看点 + 时长  │  ──▶    │  平台（站外） │  ──▶  │ + 模板 + 点评 │
   │ [去看课 ↗]     │         │  本站页面保活 │       │ 自动引导回来  │
   └────────────────┘         └──────────────┘       └──────────────┘
     给足理由再放走            新标签页 = 物理保障      回来有事可做
```

- **①「看之前」给足理由**：不是干巴巴一个链接，而是先告诉他这节课讲什么、哪 3 个点值得看、要花多久。这是"导学"的本体，也是本站相对于直接搜索的价值。看完这段再点出去的人，是带着任务出去的，回来率天然高。
- **②「看的时候」保活本站页面**：外链一律 `target="_blank"`，本站标签页不销毁。这不是营销技巧，是**移动端的现实约束**——教师在微信 webview 里打开，如果同标签跳走，返回本站的成本极高（要么依赖微信返回栈，要么就再也不回来了）。新标签是对用户更友好的默认。
- **③「看完之后」主动接住**：这是本页最关键的一个交互，单独展开讲。

### 4.3 关键交互：「欢迎回来」回访条（`.lit-back-bar`）

**触发逻辑**（纯前端，无后端依赖）：

1. 用户点击「去国家平台看这节课」→ 写 `localStorage['ea:lit:out:{moduleId}:{lessonId}'] = Date.now()`
   （键名前缀 `ea:` 与现有约定一致，见 `SopPathView.tsx:127` 的 `ea:sop:...` 和 `auth.ts:5` 的 `ea_user`）
2. 本站标签页监听 `document.visibilitychange`；当页面重新可见时读取该键
3. **距今 > 90 秒** → 判定"他真的去看了"，在 `.crumb` 下方展开回访条：
   ```
   ┌ .lit-back-bar  role="status" aria-live="polite" ─────────────┐
   │ <Icon ArrowUUpLeft 16/>  看完《三段式提示词》了？             │
   │ 下面这 2 条 SOP 就是配套的动手练，趁热做一遍。                 │
   │                              [跳到动手练 ↓] btn-sm btn-primary│
   │                                        [×] 关闭（写入 dismiss）│
   └───────────────────────────────────────────────────────────────┘
   ```
   点击「跳到动手练」→ `scrollIntoView({ behavior: 'smooth', block: 'start' })` 到 `#practice` 锚点（`html` 已有 `scroll-padding-top: 80px`，globals.css:66，锚点不会被吸顶 Header 遮住 —— 已核实）
4. **距今 ≤ 90 秒** → 判定"只是瞄了一眼"，不打扰；只在外链按钮上加一枚 `<Icon name="Check" size={12}/> 已打开` 的轻标记
5. **同一课 24 小时内只弹一次**；用户点 `×` 后写 `ea:lit:backbar-dismiss:{lessonId}`，7 天内不再弹
6. **降级**：`localStorage` 不可用（隐私模式 / 微信某些版本）→ 整个机制静默失效，回访条不出现，页面其余部分完全正常。**SOP 区不依赖这个机制存在**，它本来就在页面上。

**为什么是 90 秒**：低于这个时长基本是误触或加载失败；一节 12-15 分钟的课，看个开头也要一两分钟。宁可漏掉一部分，也不要对一个刚点错的人弹提示——那会显得很吵。

**动效**：展开用 `max-height` + `opacity` 过渡，`0.2s ease`（与 `.lit-mod`、`.sop-link`、`.chip-link` 同一个 timing，globals.css:1766/1826/1842）。**不用弹跳缓动**。`prefers-reduced-motion` 已由 globals.css:107-116 全局兜底。

### 4.4 完整线框

```
┌─ .wrap.py-8 ──────────────────────────────────────────────────────┐
│ .crumb  AI通识课 / 提示词基础 / 三段式提示词                       │
│                                                                    │
│ ┌ .lit-back-bar（仅回访时出现，见 4.3）────────────────────────┐  │
│ └───────────────────────────────────────────────────────────────┘  │
│                                                                    │
│ ┌ .detail-head ────────────────────────────────────────────────┐  │
│ │ 标记行: [.pb-cat 模块二·第1节] [.lit-tag-src 官方课]          │  │
│ │ h1  三段式提示词：角色 + 任务 + 约束                           │  │
│ │ .detail-tagline（= 一句话导学，最重要的一行）                  │  │
│ │   你现在写的提示词，AI 只能靠猜。这节课给你一个填空式框架，    │  │
│ │   把"帮我出份卷子"变成它真能执行的指令。                       │  │
│ │ tags: [<Clock 11/> 15分钟] [<PlayCircle 11/> 视频] [入门]     │  │
│ │       [适合：老师]                                            │  │
│ │                                                               │  │
│ │ ┌ .lit-source ★（来源说明，必须在 CTA 之前）───────────────┐ │  │
│ │ │ <Icon SealCheck 16/> 这节课的正文和视频在**国家中小学智慧 │ │  │
│ │ │ 教育平台**（basic.smartedu.cn），本站不提供课程内容、也不 │ │  │
│ │ │ 代表官方观点。这一页是「教AI导航」给这节课做的导学笔记。   │ │  │
│ │ └──────────────────────────────────────────────────────────┘ │  │
│ │                                                               │  │
│ │ .detail-actions:                                              │  │
│ │   [去国家平台看这节课 <ArrowSquareOut 14/>]  btn btn-primary  │  │
│ │   [先看动手练 <CaretDown 12/>]               btn btn-ghost    │  │
│ │   <span 12px muted> 在新页面打开 · basic.smartedu.cn </span>  │  │
│ └───────────────────────────────────────────────────────────────┘  │
│                                                     ↕ 24px         │
│ ┌ .grid-2 ──────────────────────────────────────────────────────┐ │
│ │ ┌ 主栏 ─────────────────────────────┐ ┌ 副栏 aside ─────────┐│ │
│ │ │ ① .card.lit-official ★            │ │ .card.aside-card    ││ │
│ │ │   h3 <.dot> 这节课讲什么           │ │  h3 <.dot> 本模块   ││ │
│ │ │   官方课程简介（1段，本站转述，    │ │  <LessonNav 竖列>   ││ │
│ │ │   不搬运原文）                     │ │  ▸1 三段式(当前)    ││ │
│ │ │   ── 三个看点 ──                   │ │   2 给示例给格式    ││ │
│ │ │   <Icon Lightbulb 16/> 第4分钟那个 │ │   3 常见翻车现场    ││ │
│ │ │     "把AI当新来的实习生"的比喻，   │ │   4 改写模糊需求    ││ │
│ │ │     可以直接搬到你的教研分享里     │ │  ───────────────    ││ │
│ │ │   <Icon Lightbulb 16/> …           │ │  ← 返回模块         ││ │
│ │ │   <Icon Lightbulb 16/> …           │ └─────────────────────┘│ │
│ │ │   ┌ .lit-official-cta ───────────┐ │ ┌ .card.aside-card ──┐│ │
│ │ │   │ [去国家平台看这节课 ↗]  大按钮│ │ │ h3 <.dot> 合规提示 ││ │
│ │ │   │ 免费 · 需在平台注册登录      │ │ │ .compliance        ││ │
│ │ │   │ basic.smartedu.cn            │ │ │ 学生姓名/成绩/人脸 ││ │
│ │ │   └──────────────────────────────┘ │ │ 不要喂给任何 AI    ││ │
│ │ │   链接打不开？[告诉我们] （12px）  │ └─────────────────────┘│ │
│ │ ├───────────────────────────────────┤ ┌ .card.aside-card ──┐│ │
│ │ │ ② .card.lit-take 本站点评          │ │ h3 <.dot> 这节课用 ││ │
│ │ │   h3 <.dot> 我们的看法             │ │    到的工具        ││ │
│ │ │   官方这节课讲得最好的是框架，但它 │ │ (复用 .alt-tool)   ││ │
│ │ │   举的例子偏通用。落到咱们的场景， │ │ DeepSeek           ││ │
│ │ │   "角色"这一格你就填"你是带过十年  │ │ 智谱 GLM           ││ │
│ │ │   初三的语文老师"——比"你是一个AI  │ └─────────────────────┘│ │
│ │ │   助手"管用得多。                  │                       │ │
│ │ │   ── 署名: 教AI导航编辑部 · 8月更新│                       │ │
│ │ ├───────────────────────────────────┤                       │ │
│ │ │ ③ .card  id="practice" ★转化核心   │                       │ │
│ │ │   h3 <.dot> 学完立刻练             │                       │ │
│ │ │   sub 上面是原理，这两条是打开就能 │                       │ │
│ │ │       做的步骤                     │                       │ │
│ │ │   .pb-grid（复用用法库卡片！）      │                       │ │
│ │ │    ┌ .pb-card ──┐ ┌ .pb-card ──┐  │                       │ │
│ │ │    │ 备课规划   │ │ 家校班级   │  │                       │ │
│ │ │    │ 用DeepSeek │ │ 用GLM把模糊│  │                       │ │
│ │ │    │ 练三段式…  │ │ 需求改写…  │  │                       │ │
│ │ │    │ 6步 · 老师 │ │ 4步 · 老师 │  │                       │ │
│ │ │    └────────────┘ └────────────┘  │                       │ │
│ │ ├───────────────────────────────────┤                       │ │
│ │ │ ④ .card 拿走就能用                 │                       │ │
│ │ │   .att 《万能提示词模板（填空版）》 │                       │ │
│ │ │     [复制全文] CopyButton 复用     │                       │ │
│ │ │     [下载 PDF] .dl                 │                       │ │
│ │ └───────────────────────────────────┘                       │ │
│ └───────────────────────────────────────────────────────────────┘ │
│                                                     ↕ 24px         │
│ ┌ .lit-nav ─────────────────────────────────────────────────────┐ │
│ │ ← 上一节                              下一节 →                 │ │
│ │   （本节是第1节，左侧禁用）           给示例、给格式、逐步迭代  │ │
│ │                    [返回 提示词基础]                           │ │
│ └───────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────┘
```

### 4.5 外链按钮的具体规格（逐条回答"位置/措辞/新窗口"）

| 项 | 决策 | 理由 |
|---|---|---|
| **出现次数** | 2 次（头部 `.detail-actions` 一次、主栏 `.lit-official-cta` 一次）+ 移动端 sticky 条一次 | 不止一次，是因为老师读完"三个看点"才真正下决心，那个位置必须有按钮；但**不超过 3 次**，多了像广告 |
| **位置** | 头部那颗在 `.lit-source` 来源说明**之后**——先说清"这不是我们的课"，再给按钮 | 诚实信息必须出现在决策点之前，而不是页脚小字 |
| **措辞** | 「**去国家平台看这节课**」 | 主语明确是"去别人家"。不用"立即学习""开始课程"这种含糊说法，那会让人以为在本站播放 |
| **新窗口** | `target="_blank" rel="noopener noreferrer"` | 保活本站页面；`noopener` 防 `window.opener` 反向操控，`noreferrer` 与现有 `/tool/[slug]:77` 一致 |
| **可访问提示** | `<span className="sr-only">（在新页面打开）</span>` + 可见的 `<Icon name="ArrowSquareOut" size={14} aria-hidden="true"/>` | 屏幕阅读器用户和视力正常用户拿到同一个信息 |
| **域名可见** | 按钮下方 12px 灰字显示 `basic.smartedu.cn` | 这是**反钓鱼式的诚实**：把要去的地方明明白白写出来。也是"权威感"最扎实的来源——真域名比任何徽章都可信 |
| **视觉权重** | `btn btn-primary`，`min-height:44px`（globals.css:253 已保证）；**不加发光、不加渐变** | 用现有主按钮，跟"前往官网"（`/tool/[slug]:74-81`）保持同一等级 |
| **SOP 锚点按钮** | 紧挨着外链，`btn btn-ghost`「先看动手练 ↓」 | 给"不想看视频、只想抄作业"的老师一条快路。这类老师占比不低，堵他们只会让他们跳出 |

### 4.6 为什么 SOP 区放在第③位而不是第①位

有人会主张把 SOP 提到最前面留人。我反对——**在默认状态下**：
- 页面标题是一节课，第一屏却先给 SOP，逻辑是断的；
- 这一页的独特价值恰恰是"导学"，先给练习等于自废武功。

但**降级状态下会自动前移**（见第 9 节）：当官方链接不可用时，`#practice` 区块自动上移到 `.lit-official` 之前——官方内容拿不到时，本站内容顺理成章成为主体。这个"重心随可用性迁移"的设计，比放一个错误提示要优雅得多。

---

## 5. 「官方来源」的视觉表达

### 5.1 一条反直觉的核心决策：**不做徽章，做句子**

常规做法是设计一枚"官方认证"徽章——盾牌图标 + 蓝底 + "官方" 二字。**我明确否掉这个方向。**

徽章这种形式，在用户的既有经验里表达的是"**本主体已被认证**"（蓝V、已认证商家、官方旗舰店）。把它贴在本站页面上，最直接的解读就是"教AI导航是官方认证的"——这正好是绝对不能发生的误解。徽章越精致，误解越深。

**一句完整的话反而难以被误读。** 所以来源标识的本体是一段可读的说明文字，图标只是它的引导符：

```
<Icon SealCheck 16/>  这节课的正文和视频在**国家中小学智慧教育平台**
（basic.smartedu.cn），本站不提供课程内容、也不代表官方观点。
这一页是「教AI导航」给这节课做的导学笔记。
```

三句话分别锁死三件事：**课在哪**（不在这儿）／**我们不担保什么**（不代表官方）／**这一页是什么**（我们自己的导学笔记）。

### 5.2 `.lit-source` 视觉规格

| 属性 | 值 | 说明 |
|---|---|---|
| 背景 | `var(--color-surface-2)` `#F5FAF8` | **中性**。不用 primary-soft（会显得是本站主推内容），不用 amber-soft（会显得是警告） |
| 边框 | `2px solid var(--color-border)` | 比卡片的 3px 细一档，表示"从属信息" |
| 圆角 | `var(--radius-tag)` `10px` | 比卡片 20px 小，视觉层级更低 |
| 内边距 | `12px 14px` | |
| 字号/行高 | `13px / 1.7` | |
| 文字色 | `var(--color-text)` `#134E4A` | 对比度 **8.8:1**（vs `#F5FAF8`），远超 AA |
| 强调 | 平台名用 `<b>`，**不上色** | 唯一的强调手段是字重 |
| 图标 | `<Icon name="SealCheck" size={16}/>`，色 `var(--color-muted)` | 灰色而非彩色。它是标点不是勋章 |
| 位置 | `.detail-head` 内、`.detail-actions` **之前** | 决策点之前 |

### 5.3 三个层级的来源披露（一次说太多没人看，分三处）

| 层级 | 位置 | 形态 | 内容 |
|---|---|---|---|
| **L1 标记** | 落地页/模块页的课时行 | `.lit-tag-src` 小标签「官方课」 | 只标事实，无色彩 |
| **L2 说明** | 伴学页 `.detail-head` 内 | `.lit-source` 三句话 | 课在哪 / 不代表官方 / 这页是啥 |
| **L3 免责** | 全站 Footer + 伴学页副栏 `.compliance` | 现有 `.compliance` 组件 | 「课程来源：国家中小学智慧教育平台，仅供教师学习交流。本站不对课程内容的准确性、时效性负责。」 |

### 5.4 五条硬禁令（写进组件注释）

1. ❌ **不使用国徽、党徽、教育部标识、"教育部"字样**作为视觉元素
2. ❌ **不复刻或引用官方平台的 logo、主色、字体**（官方站为蓝色系；本站保持 teal，色彩上刻意区隔 = 视觉上刻意不冒充）
3. ❌ **不使用"认证""授权""合作""指定"**等暗示合作关系的词
4. ❌ **不在本站域名下嵌入 iframe 播放官方课程**（视觉上等于把官方内容装进本站外壳，最危险的一种混淆）
5. ❌ **不镜像、不转录、不改写课程正文**；本站只写"这节课讲什么"的一段转述 + 自己的点评

### 5.5 权威感从哪来（既然不能用徽章）

- **真域名**：`basic.smartedu.cn` 直接印在按钮下方。可验证的东西才有权威感。
- **精确的元信息**：「15分钟 · 视频 · 需在平台注册登录」。含糊的描述削弱可信度，精确的削不了。
- **克制的自我定位**：本站在这一页把自己称为"导学笔记"，主动降格。**主动说小自己，反而让人更信**。
- **本站点评带署名和日期**：「教AI导航编辑部 · 8月更新」。敢署名 = 敢负责。

---

## 6. 关键组件清单

### 6.1 直接复用（零新增，先用这些）

| 现有资产 | 位置 | 在新板块的用法 |
|---|---|---|
| `<Icon>` | `src/lib/icons.tsx` | **唯一图标入口**，全板块无例外 |
| `CopyButton` | `src/components/CopyButton.tsx` | 模板"复制全文"。已含非安全上下文回退（`execCommand`），微信 webview 下可用 |
| `ToolCard` | `src/components/ToolCard.tsx` | 落地页"相关工具"区，原样 |
| `.pb-card` / `.pb-grid` | globals.css:1270-1330 | **伴学页「学完立刻练」直接用用法库卡片**，视觉与 `/usages` 完全一致 |
| `.att` / `.att .dl` | globals.css:2563-2601 | 可下载资产横条 |
| `.compliance` | globals.css:2230-2245 | 合规提示（**需改文字色，见 7.3**） |
| `.crumb` / `.detail-head` / `.detail-tagline` / `.detail-actions` / `.grid-2` / `.card` / `.card h3 .dot` / `.aside-card` | globals.css:2094-2184 | 伴学页与模块页整套骨架 |
| `.alt-tool` / `.alt-logo` / `.alt-name` / `.alt-tag` | globals.css:2874-2926 | 副栏"这节课用到的工具" |
| `.sop-timeline` / `.step-num` | globals.css:2419-2431, 2716-2727 | 模块页课时清单 |
| `.rel-banner` / `.sec-head` / `.link-more` / `.btn*` / `.tag` / `.rb` / `.empty` | 全站 | 原样 |
| `.lit-hero` / `.lit-stats` / `.lit-mods` / `.lit-mod` / `.lit-num` / `.lit-row` / `.lit-k` / `.chip-link` / `.sop-link` | globals.css:1708-1848 | 落地页保留外壳，仅内部扩展 |

### 6.2 需改造的现有组件

**`FeedbackBox`** — `src/components/FeedbackBox.tsx` 当前签名是 `{ toolSlug, toolName }`，底层调 `submitFeedback(toolSlug, kind, value)`（`src/lib/interactions.ts`）。伴学页的「链接打不开？告诉我们」需要上报的是课时，不是工具。
→ **建议**（属架构侧决策，我只提需求）：把 props 放宽为 `{ targetType: 'tool' | 'lesson', targetId: string, targetName: string }`，或新增薄封装 `LessonFeedback`。**在后端字段扩展前，前端可先用 `kind="纠错"` + 正文自动前缀 `[死链] {lesson路由}` 兜过去**，不阻塞上线。

### 6.3 新增组件（5 个）

---

#### ① `<SourceNote />` — 来源说明句

```ts
interface SourceNoteProps {
  /** 'inline' = 伴学页头部完整三句；'compact' = 副栏/页脚一句 */
  variant?: 'inline' | 'compact';
  /** 平台展示名，如「国家中小学智慧教育平台」 */
  platformName: string;
  /** 用于展示的主机名，由 officialUrl 解析得出，如 basic.smartedu.cn */
  platformHost: string;
}
```
- 结构：`<p className="lit-source"><Icon name="SealCheck" size={16} aria-hidden />…</p>`
- 状态：**无交互态**（纯静态文本，不可点、不 hover）。这是刻意的——可点击会让人以为是"认证详情"入口。
- 无障碍：作为 `<p>` 出现在 `<h1>` 之后、CTA 之前，屏幕阅读器线性阅读顺序天然正确。

---

#### ② `<OfficialCourseCard />` — 官方课卡片（本页最重的组件）

```ts
interface OfficialCourseCardProps {
  lessonTitle: string;
  /** 本站转述的课程简介，1 段，不搬运原文 */
  brief: string;
  /** 三个看点，本站编辑撰写 */
  highlights: string[];
  officialUrl: string | null;
  /** 官方平台首页，链接失效时的兜底目标 */
  platformHomeUrl: string;
  platformName: string;
  durationMin?: number;
  /** 'video' | 'article' | 'mixed' */
  format?: 'video' | 'article' | 'mixed';
  /** 需登录等前置条件说明 */
  accessNote?: string;
  status: 'ok' | 'moved' | 'archived';
  onOutbound?: () => void;   // 用于写 localStorage 出站时间戳
}
```

**四种状态**：

| 状态 | 触发 | 视觉 | CTA |
|---|---|---|---|
| **default** | `status='ok'` 且 `officialUrl` 有值 | `.card` 常态，3px `--color-border` | 「去国家平台看这节课 ↗」`btn-primary` |
| **hover**（CTA） | — | 沿用 `.btn-primary:hover`：`--color-primary-dark` + `--shadow-clay-lg` + `translateY(-1px)` | — |
| **visited**（本会话已点） | localStorage 有出站记录 | CTA 右侧追加 `<Icon Check 12/> 已打开`（`--color-muted`），按钮本身不变灰 | 同上（必须仍可再点） |
| **degraded** | `status='moved'` 或 `officialUrl` 为空 | 卡内插入 `.lit-fallback` 提示条；`#practice` 区块自动上移到本卡之前 | 「去平台首页找这节课 ↗」指向 `platformHomeUrl` |
| **archived** | `status='archived'` | 顶部中性提示「这节课在官方平台已下架或被整合」；隐藏 CTA | 无外链，只留站内 SOP |

---

#### ③ `<RelatedSopList />` — 学完立刻练（转化核心）

```ts
interface RelatedSopListProps {
  /** 关联的站内 SOP id 列表，必须指向 /usages/[id] —— 不是 /tool/[slug] */
  usageIds: string[];
  /** 区块标题，默认「学完立刻练」 */
  title?: string;
  /** 锚点 id，默认 'practice' */
  anchorId?: string;
  /** 降级时置 true，本区块渲染到官方卡之前 */
  promoted?: boolean;
}
```
- 渲染：`.pb-grid` + `.pb-card`（**完全复用用法库卡片**，含 `.pb-cat` 场景标、`.pb-steps` 步数、`.rb` 角色徽标）
- 状态：
  - **populated**：2-3 张卡（>3 张时只显示 3 张 + 「查看全部 N 条 →」指向 `/usages?scene=xxx`）
  - **empty**：复用 `.empty` —— `<Icon name="ListChecks" size={40}/>` +「这节课的配套 SOP 还在做。先去 <Link>用法库</Link> 里挑一条练手，或者 <Link>投稿</Link> 你自己的做法。」**绝不留白**
  - **loading**：SSR 直出，无 loading 态
- ⚠️ **修一个现存 bug**：现 `literacy/page.tsx:129` 的配套 SOP `href={/tool/${sop.tool}}` 指向工具页，与标题不符。新板块一律 `href={/usages/${id}}`。

---

#### ④ `<LessonNav />` — 课时导航

```ts
interface LessonNavProps {
  layout: 'sidebar' | 'footer';
  moduleId: string;
  moduleTitle: string;
  lessons: { slug: string; title: string; index: number; source: 'official' | 'site' }[];
  currentSlug: string;
}
```
- `layout='sidebar'`：副栏竖列，当前项 `aria-current="page"` + 左侧 3px `--color-primary` 竖条 + `--color-primary-soft` 底
- `layout='footer'`：页面底部两端对齐的上一节/下一节 + 居中「返回本模块」
- 状态：
  - **default / hover**：hover 时 `border-color: var(--color-border-strong)`（与 `.lit-mod:hover` 同语言）
  - **current**：不可点，`aria-current="page"`
  - **disabled**（首节的"上一节"/末节的"下一节"）：渲染为 `<span>` 而非 `<a>`，`opacity: .45`，**不渲染成灰色的可点按钮**（避免点了没反应）
- 边界：翻页**锁在模块内**，不跨模块。末节的"下一节"位置改为「进入下一模块 · AI伦理与安全 →」

---

#### ⑤ `<AssetDownload />` — 可下载/可复制资产

```ts
interface AssetDownloadProps {
  name: string;                 // 《万能提示词模板（填空版）》
  desc?: string;                // 一句话说明
  /** 可一键复制的纯文本正文；有值则显示「复制全文」 */
  copyText?: string;
  /** PDF/图片下载地址；无值则不显示下载按钮 */
  fileUrl?: string;
  fileMeta?: string;            // 'PDF · 240KB'
  /** 需加企微领取的高清可编辑版 */
  gated?: boolean;
}
```
- 结构：复用 `.att`（`<Icon name="FileText" size={20}/>` + `<b>{name}</b>` + `<small>{fileMeta}</small>` + 右侧动作区）
- 状态：**default / hover**（`.att:hover` 已有 `border-color: var(--color-primary)`）／**copied**（`CopyButton` 自带 2s `.copied` 态）／**gated**（下载按钮换成「加企微领可编辑版」，用 `.dl` 同款样式但 `--color-accent-soft` 底）／**missing**（`copyText` 与 `fileUrl` 都为空时整条不渲染，不留空壳）

### 6.4 图标清单（全部已在 `@phosphor-icons/react` 中核实存在）

| 图标名 | 尺寸 | 用途 |
|---|---|---|
| `GraduationCap` | 14 | rel-banner（现有） |
| `ArrowRight` | 12 | 站内跳转（现有） |
| `ArrowUpRight` | 10-12 | 站内新页/工具（现有） |
| `BookOpen` `Wrench` `LinkSimple` | 13 | lit-stats（现有） |
| `ListNumbers` | 11-12 | SOP 步数（现有） |
| `Star` | 10 | 编辑精选（现有） |
| `ShieldCheck` | 16 | 合规提示（现有） |
| `Check` | 12 | 已复制 / 已打开（现有） |
| **`SealCheck`** | 16 | 来源说明引导符 ★新 |
| **`ArrowSquareOut`** | 14 | **外链专用**，与站内 `ArrowUpRight` 严格区分 ★新 |
| **`Bank`** | 20 | 配对条·官方侧 ★新 |
| **`PlayCircle`** | 11-13 | 视频形式 / 官方课数 ★新 |
| **`Clock`** | 11 | 时长 ★新 |
| **`Lightbulb`** | 16 | 三个看点 ★新 |
| **`CheckCircle`** | 16 | "学完你能——"清单 ★新 |
| **`FileText`** | 20 | 资产 ★新 |
| **`DownloadSimple`** | 14 | 下载 ★新 |
| **`ArrowUUpLeft`** | 16 | 回访条 ★新 |
| **`CaretLeft` / `CaretRight`** | 14 | 上一节/下一节 ★新 |
| **`CaretDown`** | 12 | "先看动手练"锚点 ★新 |
| **`WarningCircle`** | 16 | 外链失效降级提示 ★新 |
| **`ListChecks`** | 40 | SOP 空状态 ★新 |

**尺寸纪律**：行内跟随文字 10-14px（沿用现有页面惯例）／按钮内 12-16px／区块引导 16-20px／空状态 40px。**禁止出现表格外的尺寸**。

> ⚠️ `Icon` 组件在名称拼错时 `return null` 且仅 `console.warn`（icons.tsx:87-92）——**图标会静默消失**。上面每个名字我都对 `node_modules/@phosphor-icons/react/dist/csr/` 逐一核对过，实现时请勿凭记忆改名。

---

## 7. Design Token 使用

### 7.1 沿用的现有变量（全部来自 `globals.css` `@theme inline`，第 8-53 行）

**颜色**

| 变量 | 值 | 新板块用途 |
|---|---|---|
| `--color-bg` | `#F0FDFA` | 页面底 |
| `--color-surface` | `#FFFFFF` | 所有卡片底 |
| `--color-surface-2` | `#F5FAF8` | `.lit-source` / `.lit-entry` hover / `.lit-tag-src` |
| `--color-primary` | `#0D9488` | 主按钮底、图标强调、`.dot`；**≥14px 正文链接不用它，见 7.3** |
| `--color-primary-dark` | `#0F766E` | 链接文字色、按钮 hover 底、chip 文字 |
| `--color-primary-soft` | `#E6F7F5` | LessonNav 当前项底、chip-link 底 |
| `--color-accent` / `--color-accent-soft` | `#F59E0B` / `#FEF9E7` | 仅 gated 资产（加企微领取）标记 |
| `--color-text` | `#134E4A` | 所有正文；**含 `.lit-source`** |
| `--color-muted` | `#64748B` | 次级说明、元信息、来源图标 |
| `--color-border` | `#CCE8E4` | 卡片 3px 边、分隔线 2px |
| `--color-border-strong` | `#5EEAD4` | hover 边框 |
| `--color-amber` / `--color-amber-soft` | `#F59E0B` / `#FFFBEB` | `.lit-fallback` 底与图标（**文字色见 7.3**） |
| `--color-green` / `--color-green-soft` | `#10B981` / `#ECFDF5` | 免费标记 |
| `--color-red` / `--color-red-soft` | `#EF4444` / `#FEF2F2` | 仅 archived 状态 |

**阴影 / 圆角 / 字体**

| 变量 | 值 | 用途 |
|---|---|---|
| `--shadow-clay` | `inset -2px -2px 6px rgba(0,0,0,.04), 3px 3px 6px rgba(0,0,0,.06)` | 卡片常态 |
| `--shadow-clay-lg` | `inset -3px -3px 10px rgba(0,0,0,.05), 6px 6px 16px rgba(0,0,0,.08)` | hover |
| `--shadow-clay-press` | `inset 2px 2px 4px rgba(0,0,0,.06)` | active |
| `--radius-card` `20px` / `--radius-btn` `16px` / `--radius-input` `14px` / `--radius-tag` `10px` / `--radius-chip` `9999px` | | 卡片/按钮/输入/标签/胶囊 |
| `--font-heading` Nunito 800-900 | | h1/h2/h3、`.lit-num` |
| `--font-body` DM Sans | | 正文、按钮 |
| `--font-mono` JetBrains Mono | | `.lit-k`、`.step-num` 编号、`.lit-tag-src`、时长数字 |

**字号**（本站无字号 token，以下取值全部来自现有页面已出现的值，不新造）
`12px` 元信息／`13px` 说明、标签、`.lit-source`／`14px` 正文、按钮／`15px` `.detail-tagline`／`17px` `.lit-mod h3`／`28px` `.detail-head h1`／`clamp(1.25rem,3vw,1.75rem)` `.sec-head h2`

**间距**：`4 / 6 / 8 / 10 / 12 / 14 / 16 / 18 / 20 / 22 / 24 / 32 / 48`（全部已在现有 CSS 出现）

**动效**：`transition: all 0.2s ease`（`.lit-mod` / `.chip-link` / `.sop-link` / `.att` 现用值）。**新组件一律用它**，不引入新缓动，不用弹跳曲线。

### 7.2 需要新增的变量（6 个，写进 `@theme inline`）

```css
@theme inline {
  /* —— 修补：现有 CSS 三处引用了未定义的 --color-secondary —— */
  --color-secondary: #2DD4BF;

  /* —— 新增：官方来源语义别名（值全部指向现有中性色，不引入新色相）—— */
  --color-official-bg:     var(--color-surface-2);   /* #F5FAF8 */
  --color-official-border: var(--color-border);      /* #CCE8E4 */
  --color-official-fg:     var(--color-text);        /* #134E4A */

  /* —— 新增：对比度达标的可读色（见 7.3）—— */
  --color-link-safe: var(--color-primary-dark);      /* #0F766E, 5.19:1 on #fff */
  --color-warn-fg:   #92400E;                        /* amber-800, 6.68:1 on #FFFBEB */
}
```

**命名说明**：现有习惯是 `--color-{语义}` / `--color-{语义}-{变体}`（`primary-dark` `primary-soft` `amber-soft`）。新增的 `official-bg/border/fg` 与 `link-safe` `warn-fg` 遵循同一模式。三个 `official-*` **刻意只是别名**——这样"来源标识用中性色"这条设计约束被写进了 token 层，后来者想给它上色时会先撞到这个别名，从而看到这条决策。

**为什么不给"官方"一个专属品牌色**：任何自选彩色都会争夺 CTA 的视觉权重，且都可能被解读为"官方色"。中性 = 克制 = 不喧宾夺主，正好是要求。

### 7.3 两个必须修的对比度问题（我实测算过）

**① `--color-primary` 做正文链接色不达标。**
`#0D9488` on `#FFFFFF` = **3.79:1**，未过 WCAG AA 正文 4.5:1（只过 3:1 的大字/UI 组件线）。
现状受影响：`.rel-banner a`（globals.css:1459，14px，在 `#E6F7F5` 上仅 **3.42:1**）、`.link-more`（14px）、`.sop-link:hover`。
→ **新板块规则**：≤16px 的链接与正文一律用 `--color-link-safe`（= `--color-primary-dark` `#0F766E`，白底 **5.19:1**）。`--color-primary` 只用于：按钮底色、图标、`.dot`、边框、≥20px 大字。
→ 现有页面的同类问题列为 advisory，不在本次范围内强改。

**② `.compliance` 文字对比度严重不足。**
globals.css:2236 用 `color: var(--color-amber)` `#F59E0B` 配 `#FFFBEB` 底 = **2.11:1**，13px 文字，明显不合格。
→ 改为 `color: var(--color-warn-fg)` `#92400E` = **6.68:1**。图标仍可保留 `--color-amber` 提供色彩识别（图标属非文本内容，3:1 即可）。
→ 这是**一行改动**，且能同时修好 `/tool/[slug]` 已有的合规提示。建议顺手做掉。

### 7.4 新增 CSS 类（命名遵循现有 `lit-` 前缀）

| 类名 | 归属 | 说明 |
|---|---|---|
| `.lit-bridge` / `.lit-bridge-side` / `.lit-bridge-side.is-ours` | 落地页 | 配对条 |
| `.lit-entry` / `.lit-entry-pain` / `.lit-entry-target` | 落地页 | 分诊列表行 |
| `.lit-mod-lessons` / `.lit-lesson-row` | 落地页 | 模块卡内课时清单 |
| `.lit-tag-src` | 全板块 | 「官方课」/「本站」中性标记 |
| `.lit-source` | 伴学页 | 来源说明句 |
| `.lit-official` / `.lit-official-cta` | 伴学页 | 官方课卡片与其 CTA 区 |
| `.lit-take` / `.lit-take-sign` | 伴学页 | 本站点评与署名 |
| `.lit-back-bar` | 伴学页 | 回访条 |
| `.lit-fallback` | 伴学页 | 外链失效提示 |
| `.lit-nav` / `.lit-nav-item` / `.lit-nav-item.is-disabled` | 模块页/伴学页 | 上下节导航 |
| `.lit-lessons` | 模块页 | 课时时间线容器（挂 `.sop-timeline` 复用竖线） |
| `.lit-num-lg` | 模块页 | 56×56 大号模块编号（`.lit-num` 的尺寸变体） |
| `.lit-sticky-cta` | 移动端 | 见第 10 节 |

---

## 8. 外链失效的降级设计

国家平台改版是**必然事件**，不是意外。所以降级不是异常分支，是常规状态之一。

### 8.1 四级降级阶梯

| 级别 | 触发 | 页面表现 | 用户损失 |
|---|---|---|---|
| **L0 正常** | `status='ok'` 且 `officialUrl` 有效 | 完整伴学页 | 无 |
| **L1 直达链失效** | 巡检标记 `status='moved'`，或 `officialUrl` 为空 | ① CTA 降级为「去平台首页找这节课 ↗」→ `platformHomeUrl`（域名根，永远有效）<br>② 卡内插 `.lit-fallback` 提示<br>③ **`#practice` 区块上移到官方卡之前** | 需自己在平台搜一下；本站内容全部可用 |
| **L2 课程下架** | `status='archived'` | ① 顶部中性提示条，隐藏所有外链 CTA<br>② 页面主体只剩本站点评 + SOP + 模板<br>③ 页面**不 404、不 301**（保住已积累的搜索权重） | 看不到官方课；本站内容全部可用 |
| **L3 整节报废** | 内容侧决定移除 | 301 到所属**模块页**（不是首页——模块页语义最近） | 落到同主题的清单页 |

### 8.2 `.lit-fallback` 文案与视觉

```
┌ .lit-fallback ────────────────────────────────────────────────┐
│ <Icon WarningCircle 16/>                                       │
│ 这节课的直达链接暂时失效了——国家平台改版时会调整课程地址。      │
│ 你可以到平台首页搜「三段式提示词」，我们也在找新地址。           │
│ 不影响下面的动手练，那部分是我们自己的。                        │
│                          [去平台首页 ↗]  [告诉我们打不开]       │
└────────────────────────────────────────────────────────────────┘
```

- 底 `--color-amber-soft` `#FFFBEB`／边 `2px solid rgba(245,158,11,.28)`／圆角 `--radius-tag`／文字 `--color-warn-fg`（**6.68:1**）／图标 `--color-amber`
- **语气规则**：说清"发生了什么"（平台改版）、"你现在能做什么"（去首页搜）、"我们在做什么"（在找新地址）、"什么没受影响"（动手练）。四句缺一不可。
- ❌ 绝不出现「加载失败」「404」「Error」「服务异常」这类系统腔——老师看不懂也不关心

### 8.3 降级时的版面重排（这是本节的核心设计）

L1/L2 下，主栏顺序从 `① 官方课 → ② 点评 → ③ 动手练 → ④ 资产` 变为：

```
③ 动手练（promoted）  →  ④ 资产  →  ② 点评  →  ① 官方课（降级态，收在最后）
```

**理由**：官方内容拿不到时，把一个残缺的卡片继续摆在第一位，等于把页面最好的位置留给一个坏掉的东西。让本站内容顺位补上，页面依然是"满"的，用户不会感到扑空。这比在原位放一个错误提示体面得多。

实现上只需 `RelatedSopList` 的 `promoted` prop 控制渲染顺序，无需两套模板。

### 8.4 死链发现机制（提给架构侧的需求，非设计交付）

1. **被动**：`.lit-official` 底部常驻 12px 一行「链接打不开？[告诉我们]」→ 走 `FeedbackBox`（需 6.2 的 props 放宽）。把死链修复变成 UGC。
2. **主动**：每周一次 cron 对全部 `officialUrl` 发 `HEAD`；非 2xx 则把 `status` 置 `moved` 并通知运营。
3. **兜底**：`platformHomeUrl` 作为**必填字段**（不是可选）——保证任何状态下都至少有一个有效外链目标。

### 8.5 空状态与边界（一并覆盖）

| 场景 | 表现 |
|---|---|
| 课时无关联 SOP | `.empty` + `<Icon ListChecks 40/>` +「这节课的配套 SOP 还在做。先去用法库挑一条练手，或者投稿你自己的做法。」+ 两个链接 |
| 课时无可下载资产 | 整个"拿走就能用"卡片**不渲染**（不留空壳） |
| 模块下只有 1 节课 | 底部 `.lit-nav` 上下节都禁用，只保留「返回本模块」 |
| 课名超长（>24 字） | h1 `overflow-wrap: anywhere`；副栏 LessonNav 课名 2 行截断 `-webkit-line-clamp: 2` |
| 三个看点只写了 1 条 | 按实际条数渲染，不补空位、不显示"暂无" |

---

## 9. 响应式（教师主战场是微信里的手机）

### 9.1 沿用现有断点（globals.css:3136 / 3155 / 3197 + `.wrap` 的 768）

| 断点 | 现有行为 | 新板块补充 |
|---|---|---|
| **≤1024px** | `.grid-2` → `1fr`（副栏落到主栏下方）；`.pb-grid` → 2 列 | **副栏内容重排**：LessonNav 从竖列变为**顶部横向滚动 chip 条**（复用 `.cat-nav` 在 ≤920 时已验证的横滚模式，globals.css:3165-3184）；合规提示与工具列表下沉到页尾 |
| **≤920px** | `.nav-links` 隐藏，BottomNav 接管 | `.lit-bridge` 由「左右并排 + →」变为「上下堆叠 + ↓」（箭头图标换 `CaretDown`）|
| **≤640px** | `.wrap` padding 24→16px；`.pb-grid` → 1 列 | 见 9.2 |

### 9.2 ≤640px 的六条具体调整

1. **面包屑压缩**：`.crumb` 只保留末两级，前面加一个 `<Icon CaretLeft 14/>` 返回上级。避免 3 级面包屑在 375px 下折成两行。
2. **`.detail-head` 去横向布局**：`padding: 30px` → `20px 18px`；h1 `28px` → `22px`。
3. **`.lit-entry` 折两行**：痛点句一行、目标课一行右对齐箭头；整行 `min-height: 56px`。
4. **`.lit-bridge` 纵向**：两块上下堆叠，中间 `CaretDown` 图标居中。
5. **课时行去掉次要元信息**：模块卡内 `.lit-lesson-row` 只留「序号 + 课名 + [官方课] + →」，隐藏时长与 SOP 数（`display: none`，桌面端恢复）。
6. **`.att` 动作按钮换行**：`max-width: 360px` 取消，改 `width: 100%`，「复制全文」「下载」两个按钮各占一半宽度、`min-height: 44px`。

### 9.3 移动端 sticky CTA（`.lit-sticky-cta`）——必须避开 BottomNav

这是移动端转化的关键，也是**唯一一个有冲突风险的元素**，规格必须精确：

```
已核实：BottomNav 是 fixed bottom-0，高 h-16 = 64px，z-50（BottomNav.tsx:19-20）
        body 有 pb-16 md:pb-0（layout.tsx:48）
```

| 属性 | 值 |
|---|---|
| 显示条件 | 仅 `≤920px` 且伴学页且页面已滚过 `.detail-head`（`IntersectionObserver`） |
| 定位 | `position: fixed; left: 0; right: 0; bottom: 64px;`（**正好压在 BottomNav 之上，不遮挡**） |
| `z-index` | `45`（低于 BottomNav 的 50，高于内容） |
| 高度 | `56px` + `padding: 8px 16px` |
| 背景 | `var(--color-surface)`，`border-top: 3px solid var(--color-border)`（与 BottomNav 的 border-top 形成两道线，视觉上是"两层工具条"，不是错位） |
| 内容 | 左「去官方看课 ↗」`btn btn-primary`（占 60% 宽）／右「动手练 ↓」`btn btn-ghost`（40%）；两者 `min-height: 44px` |
| 页面补偿 | `<main>` 追加 `padding-bottom: 56px`（BottomNav 的 64px 已由 body `pb-16` 覆盖） |
| 退出 | 滚到页面底部 `.lit-nav` 可见时淡出（`0.2s ease`），把最后一屏还给内容 |

### 9.4 微信 webview 三条特别注意

1. **`target="_blank"` 在微信内**表现为在当前 webview 打开新页面，**依赖微信原生返回**回到本站。这仍优于同标签跳转（同标签在部分场景会丢失滚动位置和历史）。回访条的 `visibilitychange` 监听在微信返回时同样会触发 —— 机制成立。
2. **`pb-safe` 类目前未定义**（`BottomNav.tsx:20` 在用，但项目无 `tailwind.config`，Tailwind v4 也不内置该类）→ iPhone 刘海屏底部安全区**当前是失效的**。建议在 globals.css 补：
   ```css
   .pb-safe { padding-bottom: env(safe-area-inset-bottom, 0px); }
   ```
   并给 `.lit-sticky-cta` 的 `bottom` 改为 `calc(64px + env(safe-area-inset-bottom, 0px))`。
3. **复制功能**：微信 webview 常为非安全上下文，`navigator.clipboard` 不可用。现有 `CopyButton` 已内置 `execCommand('copy')` 回退（CopyButton.tsx:20-37），**直接复用即可，不要另写复制逻辑**。

---

## 10. 无障碍

### 10.1 外链（本板块最关键的一条）

```tsx
<a
  href={officialUrl}
  target="_blank"
  rel="noopener noreferrer"
  className="btn btn-primary"
  onClick={markOutbound}
>
  去国家平台看这节课
  <Icon name="ArrowSquareOut" size={14} aria-hidden="true" />
  <span className="sr-only">（在新页面打开，前往 basic.smartedu.cn）</span>
</a>
```

- `rel="noopener noreferrer"` — **`noopener` 必须有**。全站 grep 结果：目前**零处**使用 `noopener`，`/tool/[slug]:77` 只有 `noreferrer`。这是一个真实的安全缺口，新板块必须补上，并建议顺手修 tool 页那一处。
- 视觉提示 `ArrowSquareOut` 与站内跳转的 `ArrowUpRight` **严格区分**：站外方框箭头、站内斜箭头。全板块无例外。
- `sr-only` 文本同时说明"新页面"和"去哪"，屏幕阅读器用户获得与视力用户等量的信息（视力用户从按钮下方的域名小字获得）。
- `sr-only` 由 Tailwind v4 内置提供（globals.css:1 已 `@import "tailwindcss"`），无需自定义。

### 10.2 对比度（实测值）

| 组合 | 比值 | 判定 |
|---|---|---|
| `--color-text #134E4A` on `#FFFFFF` | **8.8:1** | AAA ✅ |
| `--color-text` on `--color-surface-2 #F5FAF8` | **8.5:1** | AAA ✅（`.lit-source` 用此组合） |
| `--color-muted #64748B` on `#FFFFFF` | **4.76:1** | AA ✅（仅用于 ≥12px 元信息） |
| `--color-primary-dark #0F766E` on `#FFFFFF` | **5.19:1** | AA ✅（链接色） |
| `--color-primary #0D9488` on `#FFFFFF` | **3.79:1** | ❌ 正文不合格 → 见 7.3，仅用于按钮底/图标/边框 |
| `#FFFFFF` on `--color-primary #0D9488`（主按钮） | **4.62:1** | AA ✅ |
| `.compliance` 现状 `#F59E0B` on `#FFFBEB` | **2.11:1** | ❌ 必修 → `--color-warn-fg #92400E` = **6.68:1** ✅ |
| `--color-primary-dark` on `--color-primary-soft #E6F7F5` | **4.63:1** | AA ✅（chip-link、LessonNav 当前项） |

### 10.3 键盘与语义

- **焦点环**：globals.css:81-85 已全局 `:focus-visible { outline: 3px solid var(--color-primary); outline-offset: 2px }`。新组件**一律不得覆盖或移除**。`.lit-entry`、`.lit-lesson-row`、`.lit-nav-item` 作为整行链接必须能接收焦点。
- **触摸目标 ≥44×44px**：`.btn` 已有 `min-height: 44px`（globals.css:253）；⚠️ **`.btn-sm` 只有 36px**（globals.css:296）—— 移动端的主 CTA 与 sticky 条**不得使用 `btn-sm`**。`.lit-entry` 行 `min-height: 48px`，`.lit-lesson-row` `min-height: 44px`。
- **标题层级**：伴学页 `h1`（课名）→ `h2`（`.sec-head` 区块，如「学完立刻练」）→ `h3`（`.card h3`）。不跳级、不用样式冒充层级。
- **`aria-current="page"`**：LessonNav 当前课、模块页侧栏当前模块。
- **回访条**：`role="status" aria-live="polite"`，异步出现时被朗读；关闭按钮 `aria-label="关闭这条提示"`，`min-width/height: 44px`。
- **锚点跳转**：`html { scroll-padding-top: 80px }`（globals.css:66）已保证 `#practice` 不被 sticky Header（64px）遮挡 —— 已核实。
- **降级提示**：`.lit-fallback` 用 `role="status"`（非 `alert`——它不是紧急事件，不该打断朗读）。
- **图标**：装饰性图标一律 `aria-hidden="true"`；无文字的图标按钮必须 `aria-label`。
- **减少动效**：globals.css:107-116 已全局处理 `prefers-reduced-motion`，回访条展开与 sticky 淡入自动降为瞬变。

---

## 11. 反 AI 模板味自检（P0 逐条）

| 红线 | 本方案状态 |
|---|---|
| 禁 emoji 作功能图标 | ✅ 全文零 emoji；所有图标写成 `<Icon name="X" size={n}/>`，20 个名称全部对 `node_modules/@phosphor-icons/react/dist/csr/` 逐一核实存在。⚠️ 附带发现：原型稿 `design/ailiteracy.html:871-875` 仍是 🎓📚🛠️🔗，但 Next.js 实现已全部替换为 `<Icon>`，线上无 emoji |
| 禁紫→粉渐变 / 发光边框 / 毛玻璃三件套 | ✅ 全板块 teal 单色系；无渐变主视觉、无发光、无毛玻璃。**并主动移除**现有 `.lit-hero h1` 的 teal→violet 渐变文字（globals.css:1717-1720） |
| 禁 AI 模板文案 | ✅ 无 "Welcome to"、无 Lorem ipsum。所有示例文案是可直接上线的教师语态："会用，但它老是答非所问""下周就开学，我要能直接用的东西""你现在写的提示词，AI 只能靠猜" |
| 禁硬编码颜色 | ✅ 全部 `var(--color-*)`。唯一新增裸值 `--color-warn-fg: #92400E`，且**定义在 token 层**（`@theme inline`），组件内不出现 |
| 禁千篇一律 Hero | ✅ 不做"大标题+大按钮+抽象图形"。首屏核心是信息密实的 `.lit-bridge` 配对条 + 真实统计数字 |
| 禁弹跳缓动 `cubic-bezier(0.68,-0.55,0.265,1.55)` | ✅ 新组件统一 `0.2s ease`（与 `.lit-mod`/`.chip-link`/`.att` 一致）。注：`.btn` 现有 `cubic-bezier(0.34,1.56,0.64,1)` 是站点既有 clay 语言，本次不改动、也不扩散到新组件 |
| 禁相同卡片网格 | ✅ "你现在卡在哪儿"刻意做成分隔线列表而非三卡网格；课时清单用时间线而非卡片 |
| 禁编号 section 标记 / 每节小型大写标签 | ✅ 无 "01 · 关于" 式脚手架，无 ABOUT/PROCESS 式全大写标签 |
| 禁虚构指标 | ⚠️ 线框里的 `5 个模块 / 18 节官方课 / 24 条 SOP / 6 份模板` 是**占位结构**，上线前必须由内容侧替换为真实计数（建议由数据源自动统计，避免手写过期）。已列入 blocking |

---

## 12. 实现顺序建议

1. **先做 token 修补**（7.2 六个变量 + 7.3 两处对比度）——一次改动，全站受益，且不阻塞任何人
2. **再做伴学页**（`/literacy/[module]/[lesson]`）——它是价值核心，先跑通 1 节课的完整链路
3. **再做模块页**——骨架与伴学页高度同构，成本低
4. **最后改落地页**——需要等前两层有真实数据才能填准统计数字与课时清单
5. **`.lit-sticky-cta` 与回访条**放在最后做——它们是增益不是地基，先上线再优化

## 13. 遗留问题（需 team-lead / 架构侧拍板）

1. **`officialUrl` 的真实地址由内容侧提供**。方案中出现的 `basic.smartedu.cn` 是我基于"国家中小学智慧教育平台"给出的**示例主机名**，实现时 `platformHost` 应由 `new URL(officialUrl).hostname` 解析得出，**不要硬编码**；`platformHomeUrl` 必填，由内容侧核实后写死。
2. **`FeedbackBox` props 放宽**（6.2）需架构侧确认接口改造范围。
3. **落地页统计数字**（模块数/课数/SOP数/模板数）建议从数据源自动统计，避免硬编码后过期。
4. **`pb-safe` 未定义**（9.4-2）是现存 bug，建议本次顺手补。
5. **`--color-secondary` 未定义**：globals.css 三处引用（`.brand .logo:191`、`.sec-head h2::before:430`、`.lit-num:1785`）都写了 `var(--color-secondary, #2DD4BF)` 靠 fallback 兜着。补上定义可消除三处裸值。


