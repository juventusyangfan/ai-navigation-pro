# 教AI导航 · 原型 → Next.js 落地 PRD / 落地清单

> **文档定位**：指导把 `design/` 下的可演示原型（27 页 + `generate.js` 生成器）迁移为 `front/` 下的真实 Next.js 16 前端。本文是 PM 视角的工作说明 + 落地清单，供开发、设计、测试对齐。
> **关联文档**：`design/设计需求文档.md`（K12 设计系统 / IA / 交互规范）、`教育AI工具导航平台_系统架构设计.md`（技术架构）、`教育AI工具导航站_战略建议.md`（战略）。

---

## 1. 背景与目标（Why）

**现状**
- 已用 `design/generate.js` 产出自包含静态 HTML 原型，验证了"教育垂类 AI 工具导航 + 使用路径 SOP"的差异化价值；首页**方案A（角色快进）**与全部场景页**教学环节全流程骨架**已完成。
- 已用 `create-next-app` 起 `front/`（Next.js 16.2.12 + React 19.2.4 + Tailwind v4 + TypeScript），目前仅默认占位页，未装依赖、无业务代码。

**目标**
- 把原型还原为可维护、可扩展的真实前端，保留并强化"按角色 + 按教学环节"双轴发现体验，并具备后续接入后端 / CMS 的能力。
- MVP（Now）先交付"工具发现 + 用法学习"主链路；登录 / 收藏 / 投稿 / 通识课等做渐进增强。

**成功标准（定性）**
- 设计与 `design/` 原型视觉 / 交互一致（K12 设计 token 还原）；桌面 + H5 双端可用；页面间跳转全流程可走通。

---

## 2. 范围

### In-Scope（本阶段交付）
- **路由与页面**：首页、全部场景、场景二级页(8)、工具详情(12)、用法库、AI通识课、登录、个人中心、投稿 —— 与原型一一对应。
- **核心交互**：角色筛选（实时调暗非相关卡）、场景 / 工具 / SOP 卡片、SOP 复制 + Toast、收藏 / 笔记（MVP 用 localStorage）、锚点导航、响应式（桌面 / 平板 / H5）。
- **设计系统**：Tailwind 主题还原 K12 token（主色 / 角色色 / 圆角 / 间距 / 字体）。
- **数据**：把原型内联数据（12 工具 / 8 场景 / 9 SOP / 4 分组）抽成结构化 TS 模块（单一数据源）。

### Non-Goals（本阶段不做，防范围蔓延）
- 不接真实后端 / 数据库（Supabase 等留待 Next 阶段；MVP 状态用浏览器存储模拟）。
- 不做搜索后端（Meilisearch 留待 Later；MVP 可先用前端过滤）。
- 不做投稿审核流后端、不做账号体系（仅模拟登录态）。
- 不做内容 CMS 后台；工具 / 场景数据先硬编码在代码（结构化但非可视化编辑）。
- 不做 i18n、不做多端 App（仅 Web + H5 响应式）。

---

## 3. 信息架构与路由映射

| 原型文件 | Next.js 路由 (App Router) | 类型 |
|---|---|---|
| `design/index.html` | `app/page.tsx` → `/` | L1 |
| `design/scenes.html` | `app/scenes/page.tsx` → `/scenes` | L1 |
| `design/scene-*.html` (8) | `app/scenes/[key]/page.tsx` → `/scenes/beikeguihua` … | L2 |
| `design/usages.html` | `app/usages/page.tsx` → `/usages` | L1 |
| `design/tool-*.html` (12) | `app/tools/[slug]/page.tsx` → `/tools/doubao` … | L2 |
| `design/ailiteracy.html` | `app/literacy/page.tsx` → `/literacy` | L1 |
| `design/login.html` | `app/login/page.tsx` 或弹层 | L1 |
| `design/profile.html` | `app/profile/page.tsx` → `/profile` | L1 |
| `design/submit.html` | `app/submit/page.tsx` → `/submit` | L1 |

> **路由段约定**：场景 key（`beikeguihua / kejian / zuoye / xueqing / jiaxiao / zixue / keti / shijian`）与工具 slug（`doubao / deepseek / glm / kimi / wenxin / tongyi / wenku / jianying / canva / gamma / bishun / mistral`）直接作为路由段，保持与原型一致；`[key]` / `[slug]` 用 `generateStaticParams` 预渲染全部已知项。

---

## 4. 技术架构与关键决策

- **框架**：Next.js 16 App Router + React 19 + TypeScript + Tailwind v4（`front/` 脚手架默认）。
- **数据层（核心重构）**：新建 `front/src/lib/data.ts`，导出 `SCENES / CATS / TOOLS / USAGES`，从 `design/generate.js` 搬运并类型化。把内联数据变为**单一数据源（single source of truth）**，这是迁移动作成败的关键。
- **组件化**：把原型 inline 结构拆为组件——`SiteHeader / SiteFooter / H5TabBar / RoleTabs / PhaseSpine / SceneCard / ToolCard / SopCard / FilterBar / Toast`。角色筛选、收藏等交互组件标 `'use client'`。
- **样式**：在 `globals.css` 用 Tailwind v4 的 `@theme` 定义设计变量（`--color-primary: #6366f1` 等），组件用 `bg-primary` 等工具类；原型 CSS 变量作为过渡保留。
- **状态**：MVP 收藏 / 笔记 / 反馈用 `localStorage` + 轻量 Context；登录态用 cookie / localStorage 模拟。Later 接 Supabase Auth + DB。
- **渲染**：页面以 SSG / ISR 为主（工具 / 场景数据变化不频繁），契合原型"读路径走缓存"的异常设计。

---

## 5. 用户故事（节选）

- 作为**老师**，我希望在首页选"老师"角色后直接进入备课 / 作业相关场景，以便三步内找到能用的 AI 工具。
- 作为**学生**，我希望按"自学答疑 / 综合实践"场景看到适合我的工具与分步 SOP，以便不抄答案也能学会。
- 作为**家长**，我希望从"学情评价 / 家校班级"看到可参与的动作，以便协同监督不越界。
- 作为**访客**，我希望在全部场景页按"课前 → 课中 → 课后 → 发展"全流程浏览，以便建立完整心智模型。

---

## 6. 落地清单 / 路线图（Now / Next / Later）

### Now（MVP，建议 1–2 周）
- [ ] `npm install` 初始化 `front/`，跑通 dev 占位页
- [ ] Tailwind 主题还原 K12 token（颜色 / 圆角 / 间距 / 字体）
- [ ] 数据层 `lib/data.ts`（搬运 12 工具 / 8 场景 / 9 SOP / 4 分组，类型化）
- [ ] 公共组件：`SiteHeader` / `SiteFooter` / 底部 `H5TabBar`
- [ ] 首页 `/`：Hero + 角色切换场景区（方案A）+ 通识课推广 + 工具 4 列
- [ ] 全部场景 `/scenes`：角色 tab + 教学环节全流程骨架(phase-spine) + 4 分组锚点
- [ ] 场景二级页 `/scenes/[key]`：多维筛选工具列表
- [ ] 工具详情 `/tools/[slug]`：SOP 模块 + 合规 + 替代 + 收藏(localStorage)
- [ ] 用法库 `/usages`：学科 / 角色 / 场景筛选 + SOP 卡
- [ ] 响应式（桌面 / 平板 / H5）+ 跳转全流程联调

### Next
- [ ] 登录态 + 个人中心 `/profile`（收藏 / 笔记 / 反馈 / 贡献）
- [ ] 投稿 `/submit`（前端校验 + 待审核态，后端留 Later）
- [ ] AI通识课 `/literacy`（4 模块学习路径 + 配套工具 / SOP）
- [ ] 搜索（前端过滤版，后端留 Later）
- [ ] 埋点（按设计文档 §9 事件表）

### Later
- [ ] 后端：Supabase（Auth / Postgres）+ 工具 / 场景 CMS
- [ ] 搜索：Meilisearch 接入（见系统架构设计）
- [ ] 个性化推荐（基于角色 / 行为的场景与工具推荐）
- [ ] 投稿审核工作流 + 内容治理
- [ ] 数据看板（北极星 + 驱动 + 健康指标见 §7）

---

## 7. 指标体系（北极星 + 驱动 + 健康）

**北极星指标**：**周活跃教师完成"找工具 → 看 SOP"闭环次数**（即 `tool_view` 且 `sop_copy` / `sop_useful` 的发生量）——直接衡量"帮师生家长找到并学会用 AI 工具"的核心价值。

**驱动指标（输入）**
- 场景页 → 工具列表 → 工具详情 漏斗转化率
- `sop_copy` / `sop_useful`（用法库点赞收藏）次数
- `role_filter` 使用率（验证双轴发现是否有效）
- `tool_fav` 收藏数（留存信号）

**健康指标（护栏）**
- 工具详情页 30 秒留存率（内容是否真有用）
- 搜索无结果率（覆盖度预警）
- 移动端关键页面 LCP（性能，H5 体验）
- 合规提示可见 / 确认率（隐私合规护栏）

> 基线：原型阶段无埋点，MVP 上线后 2 周内建立基线，目标值按环比 +20% 设定。

---

## 8. 风险与合规

| 风险 | 应对 |
|---|---|
| 设计还原偏差 | 以 `design/` 原型 + K12 token 为基准，组件一一对应；先走查桌面 + H5 关键页 |
| 数据硬编码不可维护 | 迁移动作核心是抽到 `lib/data.ts` 单一数据源，Later 接 CMS |
| 角色混淆误用 | 角色色 + 角色筛选贯穿全站，场景卡标注适用角色 |
| 隐私 / 未成年肖像 | 插画替代真人照片；工具详情常驻合规提示（见设计文档 §11） |
| localStorage 状态跨设备丢失 | MVP 可接受；Later 接账号体系同步 |
| Next 16 较新、生态兼容 | 锁定依赖版本；Tailwind v4 走 `@theme`，遇坑查 Next 16 迁移指南 |

---

## 9. 验收标准
- [ ] 9 类页面（27 路由）均可访问，跳转无死链
- [ ] 角色筛选、教学环节骨架、锚点导航、SOP 复制 / 收藏 交互可用
- [ ] 桌面 + H5 视觉与 `design/` 原型一致（设计 token 还原）
- [ ] 数据来自 `lib/data.ts` 单一数据源，无内联硬编码散落
- [ ] 埋点按设计文档 §9 接入（Next 阶段）

---

*PRD：Product Management Expert · 2026-07-30*
