# 教AI导航 · 后台管理系统方案（含前端「后台就绪」改造路线）

> 文档目标：基于现有 `front/` 前端项目，给出「后期要做后台管理系统」前提下的前端优化路线 + 后台系统完整方案。
> 配套文档：`项目审计与优化建议.md`（2026-08-03）。本回合已先修掉 4 处直接关联后台的硬缺陷（见第 3 节）。

---

## 0. 现状与核心结论

**现状**：`front/` 是纯静态 SSG 站点，全站**唯一数据源是硬编码的 `src/lib/data.ts`**（TOOLS / SCENES / CATS / USAGES + helper）。所有页面直接 `import` 它取数，构建时一次性渲染成 HTML。

**核心结论**：
1. 当前最大的架构债是「代码即数据」——不把内容从代码里解耦，后台没法接管。
2. 审计里指出的 **C1（收藏空）、C2（反馈/笔记空）、C3（排序空操作）、B1（usage.steps 失真）**，本质都是「本该由后台提供的功能被写成死代码/写死值」。这些正好是先修好的优先级。
3. 数据模型存在**冗余**：`Tool.paths[]` 才是真实 SOP，而 `USAGES[]` 是另一份带重复元数据的「用法库卡片」，两者靠 `usageId` 弱关联 → 步数会漂（B1）。后台建模时应合并。

---

## 1. 前端「后台就绪」优化路线

### 1.1 内容建模：TS 类型 → 后端实体（合并冗余）

| 前端当前（data.ts） | 后端实体（建议） | 说明 |
|---|---|---|
| `Tool` | `tools` | slug 为主键；`roles/subjects/pros/cons/alts` 存 JSON/数组列 |
| `Tool.paths[]` | `sop_paths`（一对多）+ `sop_steps`（一对多，有序） | **真实 SOP 归这里** |
| `USAGES[]` | 合并进 `sop_paths`（`is_library_pick` 标志 + `useful_count`/`collect_count`） | 删除独立 USAGES，消除步数漂移 |
| `Scene` / `Cat` | `scenes` / `categories` | 分类法配置表 |
| （无） | `ratings` / `favorites` / `notes` / `feedback` / `submissions` | 互动与 UGC，全站当前缺失 |
| （无） | `admin_users` / `roles` / `role_permissions` | 后台 RBAC |

> 关键决策：**`usage.steps` 不再存储，改为由 `sop_steps` 实时计数推导**（解决 B1 根因）。

### 1.2 数据访问层抽象（最关键的一刀，低风险）

新增 `src/lib/content.ts` 作为**唯一取数缝**，页面不再直接 `import data.ts`：

```ts
// src/lib/content.ts —— 取数缝（StaticSource 现在，RemoteSource 将来）
export interface ContentSource {
  getTools(q?: ToolQuery): Promise<Tool[]>;
  getTool(slug: string): Promise<Tool | null>;
  getScenes(): Promise<Scene[]>;
  getLibrarySops(q?: UsageQuery): Promise<LibrarySop[]>;
  getSopPath(toolSlug: string, pathId: string): Promise<SopPath | null>;
  // ...
}
// 现在：StaticSource 读 data.ts；将来：RemoteSource 调 /api/content/*
export const content: ContentSource =
  process.env.NEXT_PUBLIC_CONTENT_SOURCE === "remote" ? remoteSource : staticSource;
```

- **收益**：后台就绪后只需把 `content` 切到 `remoteSource`，**页面零重写**。
- **SSG 兼容**：静态源用 `Promise.resolve(...)` 包裹，构建期照常预渲染；动态部分（评分/收藏）改客户端 `fetch`。
- **分阶段迁移**：先迁内容重页（tools / tool / usages / scenes），其余暂留 data.ts，缝做好后逐页切换。

### 1.3 其余审计问题对齐后台（本回合未做、纳入 Phase 1）

| 项 | 做法 | 对齐后台的点 |
|---|---|---|
| A1 用法深链 | `UsageBrowser` 读 `?scene=`（加 `useSearchParams`） | 后台筛选即 URL 参数，天然一致 |
| A2/A3 链接 | 首页精选用法、搜索结果链到 `/usages/[id]` | 复用已做的用法详情页 |
| B2 有用/收藏可点 | 本地 +1 持久化 → 后台接管为真实计数 | 互动计数后台聚合 |
| B4 星级半星 | `StarRating` 支持小数视觉 | 评分后端存小数 |
| B5 幽灵角色 | 删「学校管理员」或补管理端推送内容 | 后台 `school_admin` 角色落地推送 |
| C2-笔记 | SOP 页加「我的笔记」textarea → `ea_notes` → 后台 `notes` | UGC 落库 |
| 死代码 | 删 `components/ProfileClient.tsx`、`components/ScenesBrowser.tsx` | 避免双份实现误导后台开发 |

### 1.4 媒体与上传

SOP 步骤已有 `media: {type,label}`，但当前只有 label 无真实文件。后台需：
- 对象存储（CloudBase Storage / COS / S3）存 SOP 配图/视频/样例文件；
- 前端 `media` 改为 `{type, url, label}`，加 `<Upload/>` 组件（Admin 用、前台只读）。

### 1.5 真实账号与个性化

- 用 NextAuth / 自研 JWT 替换 `localStorage` 伪登录；
- 收藏/笔记/评分/进度迁服务端，跨设备同步；
- token 带角色，驱动老师/学生/家长差异化首页（「今日推荐」「我的工作台」）。

---

## 2. 后台管理系统方案

### 2.1 定位

内容中台 + 审核流 + 数据看板 + 站点配置，RBAC 管控。让运营/编辑维护「工具库 + SOP 库」，让审核员处理 UGC，让学校管理员向本校推送精选 SOP。

### 2.2 技术选型（对比矩阵，由架构师拍板）

| 方案 | 说明 | 优点 | 缺点 | 适配度 |
|---|---|---|---|---|
| **A. Next.js 全栈单体** | 同一 `front` 仓库加 `/admin` 路由组 + Route Handlers + Postgres(Prisma) | 复用技术栈/组件/token；「基于 front 文件夹」最贴合；小步快跑 | Route Handlers 业务逻辑复杂后偏挤 | ⭐⭐⭐⭐⭐（推荐起步） |
| B. 独立 Admin 前端 + 独立 API | Vite+React(AntD/shadcn) + NestJS/Fastify | 职责清晰、可独立部署扩容 | 两套前端、两套部署、联调成本 | ⭐⭐⭐⭐ |
| C. BaaS（Supabase/CloudBase） | Postgres+Auth+Storage+RLS，少写后端 | 上线最快、自带鉴权存储 | 复杂业务逻辑/定制审核流受限 | ⭐⭐⭐（适合极速验证） |

**推荐**：起步走 **方案 A**（同仓 `/admin` + Next Route Handlers + Postgres+Prisma + 对象存储）。后期若 Admin 过重，再把 API 拆成独立 NestJS 服务（方案 B 的 API 部分）。

### 2.3 系统架构（文字图）

```
浏览器
 ├─ 公开站 /         →  Next.js 页面  →  GET /api/content/*  (缓存/ISR)
 └─ 管理站 /admin/*  →  受保护布局     →  GET/POST /api/admin/* (Auth + RBAC 守卫)
                                      ↘ 用户互动 /api/me/*     (Auth)
数据库 Postgres  ← Prisma
对象存储（SOP 媒体）
```

### 2.4 数据库 Schema（核心表）

```sql
-- 分类法
categories(id, key, name, icon, phase, desc, "order")
scenes(id, key, name, category_id, icon, roles jsonb)

-- 内容
tools(id, slug UNIQUE, name, logo, color, tagline, url,
      roles jsonb, subjects jsonb, pricing, platform,
      rating numeric, pros jsonb, cons jsonb, compliance, alts jsonb,
      status, created_at, updated_at)
sop_paths(id, tool_id FK, title, summary, est_minutes, level,
          for_role, is_library_pick bool, useful_count int, collect_count int, "order")
sop_steps(id, path_id FK, step_order, goal, action, prompt,
          output_sample, media_type, media_url, media_label,
          pitfall, tip, branch jsonb)

-- 互动 / UGC
ratings(id, user_id, tool_id, score numeric, comment, is_verified bool, created_at)
favorites(user_id, tool_id, created_at)  -- 唯一
notes(id, user_id, ref_type, ref_id, content, created_at)
feedback(id, user_id, tool_id, type, text, status, created_at)
submissions(id, user_id, type, payload jsonb, status, reviewer_id, created_at)

-- 权限
admin_users(id, email, password_hash, role_id, name, status)
roles(id, name, key)                       -- super_admin/editor/reviewer/school_admin
role_permissions(role_id, resource, action)
pushes(id, school_admin_id, sop_path_id, target, sent_at)  -- 学校管理员推送
```

### 2.5 功能模块（Admin 路由）

| 模块 | 路由 | 能力 |
|---|---|---|
| 登录/权限 | `/admin/login` `/admin/access` | 登录、角色分配 |
| 仪表盘 | `/admin` | 工具数/用法数/待审数/评分分布 |
| 工具管理 | `/admin/tools` | CRUD + 表单（角色/学科/定价/优缺点/合规） |
| 分类法 | `/admin/taxonomy` | scenes / categories 维护 |
| **SOP 编辑器** | `/admin/sops` | 核心：路径+步骤可视化编辑、设为用法库精选 |
| 用法库 | `/admin/usages` | `sop_paths` 中 `is_library_pick` 视图、排序、统计 |
| 评价/反馈/笔记 | `/admin/ratings` `/admin/feedback` `/admin/notes` | 展示与审核 |
| 投稿审核 | `/admin/submissions` | 待审/通过/驳回 工作流 |
| 用户与角色 | `/admin/users` `/admin/roles` | RBAC 管理 |
| 站点配置 | `/admin/site` | 首页推荐位、banner、订阅文案、Footer |
| 媒体库 | `/admin/media` | 上传/管理 SOP 配图视频 |
| 数据看板 | `/admin/analytics` | 访问量、SOP 完成率、热门用法 |

### 2.6 SOP 可视化编辑器（重点，差异化资产）

- **左**：路径卡片列表（Path：标题/摘要/耗时/难度/角色/是否精选）；**右**：步骤时间线编辑器。
- **每步卡片**：`goal` 输入、`action`、`prompt`（textarea，自动高亮 `{{变量}}` 并提取变量清单）、`output_sample`、`media` 上传、`pitfall`/`tip`/`branch` 子表单。
- **实时预览**：直接 import 前端的 `<SopPathView/>` 渲染 → **后台所见即前台所得**，避免两边样式脱节。
- 支持「另存为模板」「复制到另一工具」。

### 2.7 RBAC

| 角色 | 权限范围 |
|---|---|
| super_admin | 全部 |
| editor | 工具/SOP/分类/媒体 CRUD；不可改用户与权限 |
| reviewer | 评价/反馈/投稿 审核 |
| school_admin | 仅「向本校班级/老师推送精选 SOP」（落地原幽灵角色价值） |

路由级（中间件）+ 操作级（API guard）双重校验。

### 2.8 API 设计（示例）

```text
# 公开（前台取数）
GET /api/content/tools?role=&scene=&subject=&price=&minRating=&sort=
GET /api/content/tools/:slug
GET /api/content/scenes
GET /api/content/usages?scene=&role=&tool=
GET /api/content/sops/:toolSlug/:pathId

# 用户（需登录）
POST /api/me/favorites            {toolSlug}
GET  /api/me/favorites
POST /api/me/notes                {refType, refId, content}
POST /api/me/ratings              {toolSlug, score, comment}
POST /api/me/feedback             {toolSlug, type, text}
POST /api/me/submissions          {type, payload}

# 管理（登录+RBAC）
CRUD /api/admin/tools | /api/admin/sops | /api/admin/taxonomy | /api/admin/media
POST /api/admin/reviews/feedback|ratings|submissions  {id, decision}
GET  /api/admin/stats
CRUD /api/admin/users | /api/admin/roles
```

### 2.9 迁移方案（data.ts → DB）

1. 写 **seed 脚本**：解析 `data.ts` 的 `TOOLS/SCENES/CATS/USAGES`，规整导入——`Tool`→`tools`，`Tool.paths[]`→`sop_paths`+`sop_steps`，`USAGES` 的 `pick/useful/collect` 合并进对应 `sop_paths`（`usageId` 关联）。
2. 校验条数：12 工具 / 8 场景 / 4 分类 / ~13 路径 / 9 个精选。
3. 前台 `content` 切 `remoteSource`（只读），内容更新即时生效，无需重建静态。
4. （可选）双写期：后台改完即生效。

### 2.10 分阶段路线图

| 阶段 | 内容 | 交付 |
|---|---|---|
| **Phase 0（本回合已做）** | 修 C1/C2-FB/B1/C3；定位死代码 | 4 处缺陷修复，tsc 通过 |
| **Phase 1 前端后台就绪** | 取数缝 `content.ts`；A1/A2/A3 深链；B2 有用/收藏可点；B4 半星；笔记写入入口；媒体占位→上传接口 | 前端可一键切后台数据源 |
| **Phase 2 后台 MVP** | DB+Prisma；Auth+RBAC；工具管理；SOP 编辑器；登录；前台切 remote（只读） | 能在后台改工具/SOP 并前台生效 |
| **Phase 3 互动与审核** | 评分/收藏/笔记/反馈落库；投稿审核；评价审核 | UGC 闭环 |
| **Phase 4 增长壁垒** | 学校管理员推送；用法库运营；数据看板；SEO/OG；订阅后端；家长/学生内容线 | 「离不开」 |

### 2.11 待拍板决策点（影响落地）

1. **后端技术栈**：Next Route Handlers 单体（A）/ 独立 NestJS（B）/ Supabase BaaS（C）？
2. **数据库与托管**：自管 Postgres / 云 Postgres / CloudBase（腾讯生态）？
3. **Admin 是否同仓 `/admin` 路由组**（推荐，贴合「基于 front 文件夹」）？
4. **对象存储**：CloudBase Storage / 腾讯 COS / AWS S3？

---

## 3. 本回合已落地的前端修改（清单）

| 文件 | 修改 | 对应问题 |
|---|---|---|
| `components/FavButton.tsx` | 收藏键名 `ea:fav` → `ea_favs`（与 `app/profile/page.tsx` 读取一致） | C1 收藏永远为空 |
| `components/FeedbackBox.tsx` | 加 `toolSlug` 入参 + textarea 受控 + 提交写入 `ea_fb` localStorage | C2 反馈纯装饰不落盘 |
| `app/tool/[slug]/page.tsx` | `FeedbackBox` 传 `toolSlug={t.slug}` | 配套 C2 |
| `lib/data.ts` | `USAGES` 中 7 条 `steps` 字面量校正（u1/u3→2, u5/u7/u8→1, u6/u9→2），对齐真实 SOP 步数 | B1 步数失真 |
| `components/ToolsBrowser.tsx` | `最新收录` 排序补 `list.reverse()`，不再空操作 | C3 排序误导 |

> 验证（Phase 0）：`npx tsc --noEmit` 通过（exit 0）。

### 3.1 Phase 1 落地清单（2026-08-03 续做，用户指定范围：取数缝 + 深链 + 笔记入口）

| 文件 | 修改 | 对应项 |
|---|---|---|
| `lib/content.ts` | **新增**取数缝：`ContentSource` 接口 + `StaticSource`（读 data.ts）+ `RemoteSource`（调 `/api/content/*`）+ `content` 单例（按 `NEXT_PUBLIC_CONTENT_SOURCE` 切换）；re-export data 的同步常量/类型，便于逐页切换、页面零重写 | 取数缝 |
| `app/tool/[slug]/page.tsx` `app/usages/[id]/page.tsx` `app/scenes/[key]/page.tsx` | 取数改为 `await content.x()`，`import` 切到 `@/lib/content` | 取数缝 |
| `app/usages/page.tsx` | `UsagesInner` 用 `useSearchParams` 读 `?scene=/?role=` 作初始筛选，外层 `<Suspense>` 包裹 | A1 深链 |
| `app/pages/home/page.tsx` | 首页「精选用法推荐」链接由 `/tool/${tool}` 改为 `/usages/${id}`（并改显工具名） | A2 深链 |
| `app/search/page.tsx` | 搜索「用法 SOP」结果链接由 `/tool/${tool}` 改为 `/usages/${id}`，按钮「看工具」→「看用法」 | A3 深链 |
| `components/NoteBox.tsx` | **新增**笔记写入组件，写入 `ea_notes[refId] = {title, content, href, ts}` | C2 笔记入口 |
| `components/SopPathView.tsx` | 底部渲染 `<NoteBox>`，`refId` = `usageId` 或 `工具+标题` | C2 笔记入口 |
| `app/profile/page.tsx` | 「SOP 笔记」tab 读取新 `ea_notes` 结构并支持「查看 SOP →」 | C2 笔记入口 |

> 验证（Phase 1）：`npx tsc --noEmit` 源码零报错（仅 `.next` 生成类型有与本次无关的旧报错）。
> 未做（留待后续）：B2 有用/收藏可点、B4 半星、媒体占位→上传接口、死代码清理（UsageBrowser/ScenesBrowser）、B5 幽灵角色——见 1.3。

### 3.2 Phase 1b 落地清单（2026-08-03 续做：打分 + B2 + B4 + 清死代码）

| 文件 | 修改 | 对应项 |
|---|---|---|
| `lib/interactions.ts` | **新增**统一本地交互状态层：`useFav`（键 `ea_favs`）/ `useUseful`（`ea_useful`）/ `useRating`（`ea_rating`）三个 client hook，集中键名与读写逻辑，后台接入时只改这里 | 基础 |
| `components/StarRating.tsx` | **重写**：只读时按小数填充（B4 半星，整星轨道 + 裁剪填充层双轨）；`interactive` 时左半区 0.5 / 右半区 1.0 点击打分 | 打分 + B4 |
| `components/ToolRating.tsx` | **新增**工具详情页「我的评分」区：教师均分（只读）+ 用户本人可点击评分（调用 `useRating` + `StarRating` interactive），支持清除 | 打分 |
| `components/UsageUsefulCollect.tsx` | **新增**用法页「有用 / 收藏」可点按钮：`useUseful` 标记用法、`useFav` 复用工具收藏（与卡片/个人中心一致），乐观 +1 显示 | B2 |
| `components/FavButton.tsx` | 改用 `useFav`，消除与 `UsageUsefulCollect` 的重复写入逻辑 | 基础 |
| `components/SopPathView.tsx` | 社会证明头部接入 `UsageUsefulCollect`（工具详情 / 用法详情共用） | B2 |
| `app/usages/[id]/page.tsx` | 详情页头部「有用/收藏」静态文案 → `UsageUsefulCollect` | B2 |
| `app/usages/page.tsx` | 列表卡片死按钮（`data-kind` 等无处理器）→ `UsageUsefulCollect`，移除无用的 `data-useful/collect` 属性 | B2 |
| `app/tool/[slug]/page.tsx` | 头部评分改 `StarRating`（小数 + 数字）；「合规提示」卡内 `.rate-row` 静态星 → `ToolRating` 交互评分 | 打分 + B4 |
| `components/ToolCard.tsx` | 卡片评分加 `showNumber` 显示小数 | B4 |
| `app/pages/home/page.tsx` `app/literacy/page.tsx` | 裸 `<button className="fav-btn" data-slug>`（无处理器、失效）→ 可用 `<FavButton>` 组件 | 清死代码 |
| `components/UsageBrowser.tsx` `ScenesBrowser.tsx` `ProfileClient.tsx` | **删除**（均无引用；`SceneCard` 仍被 `RoleScenes`/`search` 使用，保留） | 清死代码 |
| `components/LoginForm.tsx` | 顺手修一处同类 bug：登录写入键 `ea:user` → `ea_user`，与 `profile` 页读取键一致（否则登录后个人中心仍显示未登录） | 附带修复 |

> 验证（Phase 1b）：`npx tsc --noEmit` 源码零报错（仅 `.next` 生成类型有与本次无关的旧报错）。
> 后台化衔接：`interactions.ts` 三个 hook 是前台唯一本地落盘点；后台就绪后把 hook 内 `localStorage` 读写换成远程 API 即可，组件无需改动。
> 仍留待后续（方案 1.3）：媒体占位→真实上传接口、B5 幽灵角色「学校管理员」、对比模式/学科筛下沉场景详情、真实社区信号、SEO/OG、家长/学生内容线。

### 3.3 Phase 2 后台 MVP 骨架（2026-08-03，用户指定：在 `front` 同级新建独立 `admin/` 文件夹）

**决策落地**：用户选择**独立 `admin/` 项目**（非 `/admin` 路由组）。技术栈按方案 2.2 推荐落地为 **Next.js App Router + Prisma + SQLite + JWT 会话 + RBAC**，零外部依赖即可运行。

**已建结构**（`ai-navigation-pro/admin/`）：
- 配置：`package.json` / `tsconfig.json` / `next.config.mjs` / `.env.example` / `.gitignore`
- `prisma/schema.prisma`：合并模型（Tool/SopPath/SopStep + Scenes/Categories；USAGES 合并进 SopPath.isLibraryPick）+ RBAC（AdminUser/Role/RolePermission）+ 互动表预留（User/Rating/Favorite/Note/Feedback/Submission/Push，SQLite 用 String 存 JSON）
- `prisma/seed.ts`：**直接 import `front/src/lib/data.ts`** 灌库（single source of truth），建 4 角色与默认管理员 `admin@ea.test / admin123`
- `src/lib/`：`db.ts`(Prisma 单例) / `jwt.ts`(edge 安全) / `auth.ts`(bcrypt+Cookie) / `rbac.ts`(userCan) / `serialize.ts`(DB→前端 Tool 形状) / `http.ts`(ok/fail/requireAdmin/CORS)
- `src/middleware.ts`：保护 `/admin` 与 `/api/admin`（仅校验会话，RBAC 在 handler）
- 后台页：`admin/layout`(受保护壳) / `login` / 仪表盘 / `tools`(列表+编辑) / `sops`(核心编辑器：路径+步骤可视化 + 实时预览) / `usages`(精选视图) / `taxonomy` / `users|feedback|analytics`(Phase 3 占位)
- API：`/api/auth/*` / `/api/admin/{tools,sops,taxonomy,stats}`(RBAC 守卫) / `/api/content/*`(公开读，供 front remoteSource，带 CORS) / `/api/me/*`(Phase 3 占位 501)
- `README.md`：运行步骤、前后台对接（`NEXT_PUBLIC_CONTENT_SOURCE=remote` + `NEXT_PUBLIC_API_BASE`）、SQLite→Postgres 切换说明

**验证方式**：本沙箱无法 `npm install`/`prisma generate`/`next build`（网络与 safe-delete 护栏限制），代码按 Next 15 + Prisma 6 规范手写并通过一致性自检（import 与导出、guard 模式、去除 SQLite 不支持的 `createMany`）。用户本机执行 `cd admin && cp .env.example .env && npm install && npm run db:init && npm run dev`（:3001）即可运行。

**下一步**：
- 收尾 Phase 2：在 `front` 的 `content.ts` 实现 `remoteSource`（接 `/api/content/*`），真正切后台数据源（只读即时生效）。
- Phase 3：评分/收藏/笔记/反馈/投稿落库与审核流、学校管理员推送、数据看板、媒体上传。
