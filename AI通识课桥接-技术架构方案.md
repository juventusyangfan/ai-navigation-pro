# AI 通识课桥接 · 技术架构方案

> 版本 v1.0 ｜ 架构负责人：高见远 ｜ 交付物：技术方案（不含实现代码）
> 适用仓库：`ai-navigation-pro`（front + admin 双 Next.js 应用，PM2 fork 单实例部署）

## 0. 结论先行

本方案在**完全复用现有技术栈**（Next.js App Router + Prisma + SQLite + Phosphor `<Icon>`）的前提下，
新增 3 张内容表（`LitModule` / `LitLesson` / `LitLessonSop`）+ 2 张行为表（`EventLog` / `EventDaily`），
把 `/literacy` 从一个 55 行的硬编码常量数组，升级为**可后台运营的三级导学资产**：

```
/literacy                       索引页（模块总览）        ISR 300s
  └ /literacy/[module]          模块页（课时清单）        ISR 600s + generateStaticParams
      └ /literacy/[module]/[lesson]   伴学页（SEO 核心资产）  SSG + ISR 3600s + JSON-LD
```

三条不可让步的架构红线：

1. **不存官方正文。** schema 层不设任何可容纳课程正文的字段——用「设计即约束」把合规写死在数据模型里，而不是写在 code review 清单里。
2. **canonical 指向本站自己**，不指向官方。本站页面是原创导学，不是官方内容副本；指向官方等于主动放弃全部 200 个页面的索引权。
3. **外链失效不等于页面失效。** 官方链接 broken 时页面照常渲染（导学文案 + 关联 SOP 仍在），只降级掉「去官方学」主按钮。外部依赖不能穿透成本站的可用性。

---

## 1. Prisma 数据模型设计

### 1.1 设计约束（来自现有代码，非假设）

| 约束 | 证据 | 对本方案的影响 |
|------|------|----------------|
| SQLite 无原生数组/JSON 列 | `admin/prisma/schema.prisma:3` 注释 | 所有数组字段声明为 `String`，存 `JSON.stringify(...)`，读取走 `serialize.ts` 的 `arr()` |
| `SopPath.usageId` **没有** `@unique` | `schema.prisma:75` 仅 `usageId String?` | **不能**作为 Prisma 关系的引用目标。关联必须打在 `SopPath.id` 上 |
| 前端路由 id 的真实来源是 `usageId \|\| id` | `admin/src/lib/serialize.ts:67` | 序列化时按同一表达式产出 `/usages/{id}` 链接，天然修掉当前 `/tool/${sop.tool}` 的错链 |
| 图标字段存 Phosphor 组件名 | `admin/prisma/seed-data.ts:92-107`（`icon: "Compass"` / `"PaintBrush"`） | `LitModule.icon` 沿用同一约定，前端 `<Icon name={m.icon} />`，全链路无 emoji |
| `Useful` / `Favorite` 是 `refType + refId` 多态 | `schema.prisma:130-138`、`153-161` | 通识课点赞/收藏**复用现表**，只扩 `refType = "lesson"`，不新建表 |
| 内容 API 返回裸对象/裸数组 | `api/content/usages/route.ts:22` `ok(list, ...)` | 新端点**不得**包 `{code,data,message}`，否则 `content.ts` 的 `safeFetch<T>` 泛型全线失配 |

### 1.2 关联方式的决策（关键分歧点）

需求文档问：「与 SopPath 的关联存 id 还是 usageId？」

**结论：外键存 `SopPath.id`，对外链接用 `usageId || id` 在序列化层现算。**

理由三条：

1. `usageId` 无唯一约束且可为 `null`（`schema.prisma:75`），Prisma 的 `@relation` 要求被引用字段唯一——技术上不可行。
2. `usageId` 的注释写明是「与 front data.ts 的 USAGES.id 关联（seed 用）」，是历史兼容字段。把新板块的引用完整性押在一个迟早退役的字段上，是自找的技术债。
3. `/api/content/usages/[id]` 的查询本来就是 `OR: [{ usageId: id }, { id }]`（`route.ts:11-12`），双向兼容已在 API 层做好。前端拿到 `usageId || id` 一定能打开详情页，序列化层现算零成本。

### 1.3 可粘贴 schema 片段

```prisma
// ---------------- AI 通识课桥接（导学层，不存官方正文） ----------------
// 合规基线：本站只存「官方 URL + 课程元信息 + 本站原创导学」。
// 本模型刻意不提供任何可容纳官方课程正文的字段，防止后续被误用为镜像存储。

model LitModule {
  id        String   @id @default(cuid())
  slug      String   @unique              // URL 段，如 "what-is-ai"
  num       String                        // 展示序号，沿用现页面的 "一/二/三/四"
  title     String
  summary   String                        // 一句话，列表卡片用
  desc      String                        // 模块页导语，本站原创
  icon      String   @default("BookOpen") // Phosphor 图标名，前端 <Icon name={icon} />
  goal      String?                       // 学完本模块你能做到什么
  toolSlugs String   @default("[]")       // JSON string[]，模块相关工具 slug
  keywords  String   @default("[]")       // JSON string[]，SEO 关键词
  status    String   @default("draft")    // draft|published
  order     Int      @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  lessons   LitLesson[]

  @@index([status, order])
}

model LitLesson {
  id       String    @id @default(cuid())
  moduleId String
  module   LitModule @relation(fields: [moduleId], references: [id], onDelete: Restrict)
  slug     String    @unique              // 全局唯一，URL 末段
  title    String                         // 官方课程标题（元信息，非正文）
  order    Int       @default(0)

  // —— 来源区分 ——
  source   String    @default("official") // official|original|ugc

  // —— 官方桥接元信息（source=official 时必填，其余留空） ——
  officialUrl      String?                // 国家平台课程直达 URL
  officialProvider String?  @default("国家中小学智慧教育平台")
  officialCourseId String?                // 平台侧课程标识，改版后据此重新定位
  officialColumn   String?  @default("学AI")
  stage            String?                // 学段：小学|初中|高中|通用
  durationMin      Int?                   // 官方标注时长

  // —— 本站原创导学（页面唯一正文来源，全部人工撰写） ——
  hook        String                      // 为什么这节值得花时间（≤80 字，卡片摘要）
  guideIntro  String                      // 导学正文：这节讲什么、教师视角该怎么听
  watchPoints String  @default("[]")      // JSON string[]，带着这几个问题看
  afterAction String                      // 看完立刻做什么（衔接 SOP 的过渡文案）
  editorNote  String?                     // 编辑点评：官方没讲但一线要注意的
  faq         String  @default("[]")      // JSON {q,a}[]，喂 FAQPage 结构化数据
  keywords    String  @default("[]")      // JSON string[]

  // —— 外链健康 ——
  linkStatus    String    @default("unchecked") // unchecked|ok|warn|broken
  linkCheckedAt DateTime?
  linkHttpCode  Int?
  linkFinalUrl  String?                   // 跟随重定向后的落点，与 officialUrl 不同即为改版信号
  linkFailCount Int       @default(0)     // 连续失败次数，抖动容错
  fallbackUrl   String?                   // 失效兜底：栏目列表页 / 平台站内搜索页
  archiveNote   String?                   // 失效时对用户的人工说明

  // —— 发布与计数 ——
  status         String    @default("draft") // draft|published
  publishedAt    DateTime?
  viewCount      Int       @default(0)
  officialClicks Int       @default(0)    // 外链点击缓存计数（北极星指标）
  usefulCount    Int       @default(0)    // 与 Useful(refType="lesson") 对齐
  collectCount   Int       @default(0)    // 与 Favorite(refType="lesson") 对齐

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  sops      LitLessonSop[]

  @@index([moduleId, status, order])
  @@index([status, publishedAt])
  @@index([linkStatus])
  @@index([source])
}

// 伴学课 ←→ 站内 SOP 多对多。
// 外键打在 SopPath.id（真 FK，级联安全）；对外链接用 usageId || id 现算。
model LitLessonSop {
  id        String    @id @default(cuid())
  lessonId  String
  lesson    LitLesson @relation(fields: [lessonId], references: [id], onDelete: Cascade)
  sopPathId String
  sopPath   SopPath   @relation(fields: [sopPathId], references: [id], onDelete: Cascade)
  order     Int       @default(0)
  reason    String?                       // 本站原创：为什么这条 SOP 接这节课

  @@unique([lessonId, sopPathId])
  @@index([sopPathId])
}
```

对现有 model 的**唯一侵入式改动**（一行，反向关系必需）：

```prisma
model SopPath {
  // ...原有字段全部不动...
  steps      SopStep[]
  litLessons LitLessonSop[]   // ← 新增这一行
}
```

### 1.4 行为埋点表

```prisma
// 匿名/登录用户行为事件。高频写入，刻意不加外键、不进事务。
model EventLog {
  id        String   @id @default(cuid())
  name      String                        // lit_lesson_view | lit_official_click | ...
  refType   String                        // lesson|module|path|tool
  refId     String                        // 稳定可读标识：lesson/module 用 slug
  anonId    String?                       // 前端 localStorage UUID，不含个人信息
  userId    String?                       // 登录态才有，不建 FK（避免写放大）
  props     String   @default("{}")       // JSON，事件附加字段
  ua        String?                       // 截断 120 字符
  createdAt DateTime @default(now())

  @@index([name, createdAt])
  @@index([refType, refId, createdAt])
  @@index([anonId, name, createdAt])      // 支撑 30 分钟内 view 去重
}

// 每日汇总。看板只读这张表，raw 表滚动保留 30 天。
model EventDaily {
  id      String @id @default(cuid())
  day     String                          // "2026-08-01"（SQLite 无 DATE 类型，存 ISO 字符串）
  name    String
  refType String
  refId   String
  count   Int    @default(0)
  uniques Int    @default(0)              // 按 anonId 去重

  @@unique([day, name, refType, refId])
  @@index([day])
}
```

### 1.5 RBAC 资源枚举扩展

`schema.prisma:210` 的 resource 注释枚举追加 `literacy`：

```prisma
resource String // tools|sops|taxonomy|media|ratings|feedback|submissions|users|roles|site|analytics|pushes|literacy
```

`rbac.ts:16` 已让 `super_admin` 无条件通过，判定逻辑不需要改；只需 seed 时给 `editor` 角色补 `{resource:"literacy", action:"read"}`、`{resource:"literacy", action:"write"}` 两条记录。

**为什么不复用 `sops` 资源**：通识课涉及对外链接与合规声明，风险面与 SOP 编辑不同；后续大概率会把「录课时」交给内容实习生，而 SOP 编辑权限不能顺带给出去。新增成本是注释一行 + seed 两行，收益是权限边界从第一天起就是对的。
---

## 2. 数据迁移方案

### 2.1 最大的坑：现有 seed.ts 是「清空重建」

`admin/prisma/seed.ts:21-28` 开头就是：

```ts
await db.$transaction([
  db.sopStep.deleteMany(), db.sopPath.deleteMany(),
  db.tool.deleteMany(), db.scene.deleteMany(), db.category.deleteMany(),
]);
```

线上库已有真实运营数据（12 工具 / 9 SOP / 注册用户互动）。通识课的 seed **绝不能**挂进这个脚本，否则任何一次误跑等于清库。

**结论：独立脚本 `admin/prisma/seed-literacy.ts`，全程 `upsert(by slug)`，零 `deleteMany`。**

```
package.json scripts 追加：
  "db:seed:literacy": "tsx prisma/seed-literacy.ts"
```

（`tsx` 沿用 seed.ts 现有的执行方式，不引入新依赖。）

### 2.2 硬编码数据的搬迁

数据源：`front/src/app/literacy/page.tsx:14-55` 的 `MODULES: LitModule[]`，4 个模块，每个含 `num / title / desc / tools[] / sops[{tool,title}]`。

新建 `admin/prisma/lit-seed-data.ts`，逐字段映射：

| 旧字段 | 新字段 | 转换 |
|--------|--------|------|
| `num`（"一"…"四"） | `LitModule.num` | 原样 |
| `title` | `LitModule.title` | 原样 |
| `desc` | `LitModule.desc` | 原样 |
| `desc` 首句 | `LitModule.summary` | 人工截取，不自动切（自动切会切出半句话） |
| `tools[]` | `LitModule.toolSlugs` | `JSON.stringify(tools)` |
| — | `LitModule.slug` | 新增，人工指定：`what-is-ai` / `prompt-basics` / `ai-ethics` / `ai-in-subjects` |
| — | `LitModule.icon` | 新增 Phosphor 名：`Brain` / `ChatText` / `ShieldCheck` / `Books` |
| `sops[{tool,title}]` | `LitLessonSop` | **见 2.3，需匹配** |

`status` 一律写 `published`（这 4 个模块现在就在线上展示，迁移后不能变草稿）。

### 2.3 sops 关联的匹配策略（有损，必须留人工出口）

旧数据里 `sops` 只有 `{ tool, title }`，**没有 usageId**（`page.tsx:20-23` 等）。匹配算法：

```
for (const s of module.sops):
  candidates = SopPath.findMany({ where: { tool: { slug: s.tool } } })
  hit = candidates.find(c => c.title === s.title)              // 1) 精确
     ?? candidates.find(c => norm(c.title) === norm(s.title))  // 2) 去空格/标点后相等
     ?? null
  if (!hit) → 写入 UNMATCHED 清单，控制台打印，不中断脚本
```

**不做模糊相似度匹配。** 相似度阈值调不准，错配比不配更糟——错配会把用户导到不相关的 SOP，而不配只是少一个链接。

脚本结束打印：

```
[seed-literacy] 模块 4 / 4 已 upsert
[seed-literacy] SOP 关联 5 / 8 命中，3 条待人工补录：
  - 模块「AI 伦理与安全」← kimi / "用 Kimi 检查一份作业是否过度依赖 AI"
  ...
```

这 3 条由编辑在后台 `/admin/literacy` 的关联选择器里补，30 秒一条。

> 注意：旧页面的 `sops` 是挂在**模块**下的，新模型 `LitLessonSop` 挂在**课时**下。迁移阶段模块下还没有课时，因此：
> - 阶段一（上线当天）：模块级 SOP 推荐暂存 `LitModule.toolSlugs` 旁的新字段？**不加字段。** 改为在模块页直接按 `toolSlugs` 反查 `content.usagesForTool(slug)` 动态渲染「相关 SOP」区块——数据已在 `/api/content/usages?tool=xxx`（`usages/route.ts:11,20`）现成支持，零新增存储。
> - 阶段二（课时录入后）：SOP 精准关联下沉到课时级 `LitLessonSop`，模块页的动态推荐自然被更精确的内容覆盖。

### 2.4 上线不空窗的执行顺序

```
1. admin: npx prisma db push
   → SQLite 新增 5 张表，现有表零改动（只给 SopPath 加反向关系，不产生列变更）
   → 唯一 DDL 风险：SopPath 加 litLessons 是纯 Prisma 侧关系，不生成 ALTER TABLE

2. admin: npm run db:seed:literacy
   → 4 个模块 published；课时 0 条

3. front: 部署新版 /literacy
   → getLiteracyIndex() 返回 { modules: [...4], lessons: [] }
   → 模块卡渲染逻辑：lessonCount === 0 时不显示「进入模块」入口，
     只渲染 标题 + desc + 相关工具 chip + 相关 SOP（按 toolSlugs 动态查）
   → 视觉结果与当前线上页面等价，用户无感知

4. 编辑逐条录课时（每录一条即时 revalidate，见 §5.5）
   → 某模块 lessonCount > 0 时，「进入模块」入口自动出现

5. 课时数 ≥ 20 后，把 /literacy 首页从「模块四宫格」升级为
   「模块四宫格 + 最新伴学课流」，提交 sitemap
```

### 2.5 兜底与回滚

- **取数兜底**：`getLiteracyIndex()` 的 `safeFetch` fallback 设为 `{ modules: [], lessons: [] }`（与 `content.ts:139-147` 的既有语义一致：失败不抛错）。`modules.length === 0` 时页面渲染「课程内容正在整理」态而非崩溃。因为步骤 2 已 seed，这个分支实际不会触发，但它是 admin 挂掉时 `/literacy` 不 500 的保险。
- **回滚**：新表与现有表完全解耦。回滚只需把 `front/src/app/literacy/page.tsx` 切回旧版——保留 `page.legacy.tsx.bak` 一个发布周期。DB 侧无需回滚（多几张空表无害）。
- **顺带修一个线上 bug**：旧页面 `page.tsx:129` 的 `href={/tool/${sop.tool}}` 把「配套 SOP」链接指向了工具页。新模型下链接统一走 `/usages/${usageId || id}`，这个错链随迁移一起消失。
---

## 3. 公开 API 契约

### 3.1 响应包装的取舍（与通用规范的显式偏离）

通用 API 规范要求 `{ code, data, message }`。**本方案不采用**，理由是硬性的：

`front/src/lib/content.ts:150` 起全部是 `safeFetch<Tool[]>(apiUrl("/tools"), [])` 这种「泛型直接对应响应体」的写法，
`api/content/usages/route.ts:22` 也是 `ok(list, { headers: corsHeaders() })` 裸数组。
新端点若包一层 `{code,data}`，就要么破坏 `ContentSource` 的类型一致性，要么在取数缝里写两套解包逻辑。

**决策：`/api/content/literacy/*` 沿用既有裸响应范式。** 错误仍走 `fail(status, message)`（`http.ts:10-12`，返回 `{error}` + 非 2xx），`safeFetch` 靠 `r.ok` 判定即可（`content.ts:142`）。这条偏离记入 ADR-002。

### 3.2 端点清单

所有端点：`export const dynamic = "force-dynamic"` + `ok(..., { headers: corsHeaders() })` + 导出 `OPTIONS` 返回 204，与 `usages/[id]/route.ts:5,15,18-20` 完全同构。
所有端点只返回 `status === "published"` 的数据（草稿绝不出公网）。

| Method | Path | 用途 | 消费方 |
|--------|------|------|--------|
| GET | `/api/content/literacy/index` | 一次拿全（模块 + 课时摘要），首页与 `generateStaticParams` 共用 | `/literacy`、三个 `generateStaticParams` |
| GET | `/api/content/literacy/modules` | 模块列表 | 后备 / 站点地图 |
| GET | `/api/content/literacy/modules/[slug]` | 模块详情 + 其下课时摘要 | `/literacy/[module]` |
| GET | `/api/content/literacy/lessons` | 课时列表，支持筛选 | 列表流、搜索 |
| GET | `/api/content/literacy/lessons/[slug]` | 伴学课详情（含关联 SOP、上下篇） | `/literacy/[module]/[lesson]` |
| POST | `/api/events` | 行为埋点批量上报（见 §8） | 全站 |

`/api/content/literacy/index` 是刻意设计的**聚合端点**：`/literacy` 首页要同时拿模块和课时计数，
三个页面的 `generateStaticParams` 也都要遍历全量 slug。若拆成多次请求，构建期会打出 N 次跨进程 HTTP，
在 admin 未就绪时（`content.ts:138` 注释说明的场景）失败面成倍放大。数据量 < 200 条，一次拿完最省。

### 3.3 查询参数

`GET /api/content/literacy/lessons`

| 参数 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `module` | string | — | 模块 slug 过滤 |
| `source` | `official\|original\|ugc` | — | 来源过滤 |
| `stage` | string | — | 学段过滤 |
| `link` | `ok\|warn\|broken` | — | 外链状态过滤（内部诊断用） |
| `limit` | number | 200 | 硬上限 500 |

**不做分页包装。** 与 `/api/content/usages` 保持一致（该端点也无分页，`usages/route.ts:13-22`），
内容量 < 200 时分页只增加前端复杂度。等课时数破 300 再上 `/api/content/literacy/v2/lessons` 带分页包装，
不改 v1 契约。记入 ADR-003。

### 3.4 TypeScript 接口定义（前后端共同契约）

```ts
/* ---------- 通用 ---------- */
export type LitSource = "official" | "original" | "ugc";
export type LitLinkStatus = "unchecked" | "ok" | "warn" | "broken";

/** 关联 SOP 的对外形状：id 已在服务端按 usageId || id 现算，前端直接拼 /usages/{id} */
export interface LitSopRef {
  id: string;          // = SopPath.usageId || SopPath.id
  title: string;
  toolSlug: string;
  toolName: string;
  estMinutes?: number;
  level?: string;
  steps: number;
  reason?: string;     // 本站原创：为什么这条 SOP 接这节课
}

/* ---------- 模块 ---------- */
export interface LitModuleCard {
  slug: string;
  num: string;
  title: string;
  summary: string;
  icon: string;        // Phosphor 图标名，配 <Icon name={icon} />
  toolSlugs: string[];
  lessonCount: number; // 已发布课时数；为 0 时前端不渲染「进入模块」入口
  order: number;
}

export interface LitModuleDetail extends LitModuleCard {
  desc: string;
  goal?: string;
  keywords: string[];
  lessons: LitLessonCard[];
}

/* ---------- 课时 ---------- */
export interface LitLessonCard {
  slug: string;
  moduleSlug: string;
  moduleTitle: string;
  title: string;
  hook: string;
  source: LitSource;
  stage?: string;
  durationMin?: number;
  linkStatus: LitLinkStatus;   // 前端据此决定是否渲染「去官方学」主按钮
  sopCount: number;
  order: number;
}

export interface LitLessonDetail extends LitLessonCard {
  // 官方元信息（只读展示，不含正文）
  officialUrl?: string;
  officialProvider?: string;
  officialColumn?: string;
  fallbackUrl?: string;
  archiveNote?: string;

  // 本站原创导学
  guideIntro: string;
  watchPoints: string[];
  afterAction: string;
  editorNote?: string;
  faq: { q: string; a: string }[];
  keywords: string[];

  // 关联与导航
  sops: LitSopRef[];
  prev?: { slug: string; title: string; moduleSlug: string };
  next?: { slug: string; title: string; moduleSlug: string };

  // 计数与时间（供结构化数据 dateModified）
  viewCount: number;
  usefulCount: number;
  collectCount: number;
  publishedAt?: string;
  updatedAt: string;
}

/* ---------- 聚合端点 ---------- */
export interface LitIndex {
  modules: LitModuleCard[];
  lessons: LitLessonCard[];   // 全量已发布课时摘要，按 module.order, lesson.order 排序
}
```

### 3.5 序列化层

`admin/src/lib/serialize.ts` 当前 81 行，加完 literacy 会逼近 300 行上限。按代码组织规范拆包：

```
admin/src/lib/serialize/
  index.ts       // re-export，保持 "@/lib/serialize" 导入路径不变（现有 4 处引用零改动）
  content.ts     // 迁入现有 stepToApi / pathToApi / toolToApi / usageToApi / arr
  literacy.ts    // 新增 litModuleToCard / litModuleToDetail / litLessonToCard / litLessonToDetail / sopRefToApi
```

`literacy.ts` 的核心两行（体现 §1.2 的关联决策）：

```ts
const arr = <T>(s: string): T[] => { try { const v = JSON.parse(s); return Array.isArray(v) ? v : []; } catch { return []; } };

export function sopRefToApi(r: LitLessonSop & { sopPath: SopPath & { tool: Tool; _count: { steps: number } } }): LitSopRef {
  return {
    id: r.sopPath.usageId || r.sopPath.id,   // ← 与 usageToApi:67 同一表达式
    title: r.sopPath.title,
    toolSlug: r.sopPath.tool.slug,
    toolName: r.sopPath.tool.name,
    estMinutes: r.sopPath.estMinutes ?? undefined,
    level: r.sopPath.level ?? undefined,
    steps: r.sopPath._count.steps,
    reason: r.reason ?? undefined,
  };
}
```

### 3.6 后台管理 API（受保护）

全部走 `requireAdmin("literacy", action)`（`http.ts:30-40` 现成守卫），返回裸对象（与 `api/admin/sops/route.ts:16,59` 一致）。

| Method | Path | 权限 |
|--------|------|------|
| GET / POST | `/api/admin/literacy/modules` | literacy:read / write |
| GET / PATCH / DELETE | `/api/admin/literacy/modules/[id]` | literacy:read / write / delete |
| GET / POST | `/api/admin/literacy/lessons` | literacy:read / write |
| GET / PATCH / DELETE | `/api/admin/literacy/lessons/[id]` | literacy:read / write / delete |
| PUT | `/api/admin/literacy/lessons/[id]/sops` | literacy:write（整体替换关联集合，避免增删两套接口） |
| POST | `/api/admin/literacy/lessons/[id]/check-link` | literacy:write（单条即时探活） |
| GET | `/api/admin/literacy/links` | literacy:read（健康总览） |
| POST | `/api/admin/literacy/link-check` | 定时任务入口，见 §7 |

`DELETE /modules/[id]` 必须先校验其下无课时（schema 里 `onDelete: Restrict`，Prisma 会抛错，但要转成 `fail(409, "该模块下还有 N 节课时，请先移出")` 的人话提示）。
---

## 4. 前端取数缝扩展

### 4.1 先解决文件体积：content.ts 必须拆包

`front/src/lib/content.ts` 现有 189 行，包含类型定义 + 工具函数 + `ContentSource` 接口 + `remoteSource` 实现。
加入 literacy 的 5 个类型 + 5 个方法后会超过 300 行硬上限。

**拆法（对调用方零改动）**：

```
front/src/lib/content.ts        ← 删除（改名迁移）
front/src/lib/content/
  index.ts        // 组装 remoteSource 并 export const content；re-export 全部类型
  http.ts         // apiUrl() + safeFetch()（原 130-147 行）
  types.ts        // Role/Pricing/Level/Cat/Scene/Step/Path/Tool/Usage（原 10-85 行）
  utils.ts        // roleClass() / pricingLabel()（原 91-109 行）
  source-core.ts  // tools/scenes/categories/usages 的实现（原 150-185 行）
  literacy.ts     // 新增：literacy 类型 + 5 个取数方法
```

Next.js 的模块解析对 `@/lib/content` 会优先命中目录下的 `index.ts`，
因此全站 `import { content, type Tool } from "@/lib/content"` **一行都不用改**。

> 迁移唯一注意事项：`content.ts` 与 `content/` 目录**不能共存**（解析歧义）。
> 必须在同一个 commit 里完成「删文件 + 建目录」，不能分两次提交。

### 4.2 ContentSource 接口新增方法

```ts
export interface ContentSource {
  /* ...现有 12 个方法保持原样... */

  // —— AI 通识课桥接 ——
  /** 聚合：模块 + 全量已发布课时摘要。首页与三处 generateStaticParams 共用 */
  getLiteracyIndex(): Promise<LitIndex>;
  /** 模块列表（不含课时） */
  getLitModules(): Promise<LitModuleCard[]>;
  /** 模块详情 + 其下课时 */
  getLitModule(slug: string): Promise<LitModuleDetail | null>;
  /** 课时列表，支持按模块/来源/学段筛选 */
  getLitLessons(q?: LitLessonQuery): Promise<LitLessonCard[]>;
  /** 伴学课详情 */
  getLitLesson(slug: string): Promise<LitLessonDetail | null>;
}

export interface LitLessonQuery {
  module?: string;
  source?: LitSource;
  stage?: string;
  limit?: number;
}
```

### 4.3 实现（`content/literacy.ts`）

```ts
import { apiUrl, safeFetch } from "./http";
import type { LitIndex, LitModuleCard, LitModuleDetail, LitLessonCard, LitLessonDetail, LitLessonQuery } from "./types";

const EMPTY_INDEX: LitIndex = { modules: [], lessons: [] };

export const literacySource = {
  getLiteracyIndex: () => safeFetch<LitIndex>(apiUrl("/literacy/index"), EMPTY_INDEX),

  getLitModules: () => safeFetch<LitModuleCard[]>(apiUrl("/literacy/modules"), []),

  getLitModule: (slug: string) =>
    safeFetch<LitModuleDetail | null>(apiUrl(`/literacy/modules/${slug}`), null),

  getLitLessons: (q: LitLessonQuery = {}) => {
    const qs = new URLSearchParams();
    if (q.module) qs.set("module", q.module);
    if (q.source) qs.set("source", q.source);
    if (q.stage) qs.set("stage", q.stage);
    if (q.limit) qs.set("limit", String(q.limit));
    const suffix = qs.toString() ? `?${qs}` : "";
    return safeFetch<LitLessonCard[]>(apiUrl(`/literacy/lessons${suffix}`), []);
  },

  getLitLesson: (slug: string) =>
    safeFetch<LitLessonDetail | null>(apiUrl(`/literacy/lessons/${slug}`), null),
};
```

三条约束，全部继承自现有 `safeFetch` 语义（`content.ts:139-147`）：

1. **失败返回 fallback，绝不抛错**——`/literacy` 在 admin 挂掉时降级为空态，不是 500。
2. **fallback 必须是结构完整的空值**（`EMPTY_INDEX` 而非 `null`），否则页面里到处要写 `?.`。
3. **`cache: "no-store"`** 是现有 `safeFetch` 的固定行为。这与 §5 的 ISR 不冲突：ISR 缓存的是**页面渲染结果**，`no-store` 只是让 fetch 不额外套一层 Next Data Cache，避免两层缓存过期时间打架、导致「后台改了但页面 10 分钟后才变」变成「20 分钟后才变」。

### 4.4 埋点缝（新文件，与取数缝平级）

```
front/src/lib/track.ts      // ≤120 行，见 §8
```

刻意**不放进** `content/` 目录：取数缝是「读」，埋点缝是「写」，职责分离。
---

## 5. 前端路由与渲染策略

### 5.1 层级选型

**采用三级：`/literacy` → `/literacy/[module]` → `/literacy/[module]/[lesson]`**

对比另两个候选：

| 方案 | 优点 | 致命问题 |
|------|------|----------|
| 两级 `/literacy/[lesson]` | URL 短 | 面包屑无层级、`BreadcrumbList` 结构化数据只有两跳、模块本身没有可索引落地页——而「AI 伦理与安全」这类模块词的搜索量高于任何单节课 |
| 三级但用 id `/literacy/m1/l23` | 无冲突 | URL 不可读，AI 摘要引用时链接不自解释，等于放弃 AISO |
| **三级 + 语义 slug** | 面包屑三跳、模块页可独立排名、URL 自解释 | 课时换模块时 URL 变化（见下） |

**slug 唯一性策略**：`LitLesson.slug` 打**全局 `@unique`**，而非 `@@unique([moduleId, slug])`。
这样 `/api/content/literacy/lessons/[slug]` 单键查询即可，不必带 module 参数；
URL 里的 `[module]` 段只作可读前缀与面包屑锚点，**不参与查库**。

**换模块的 URL 变更处理（MVP 简化）**：
运营约定「课时一经 published 不再变更模块归属」，写进后台交互——编辑已发布课时时 `moduleId` 下拉置灰，需先转草稿再改。
这比建一张 alias 重定向表便宜得多，而对 1-2 人团队、内容量 < 200 的场景完全够用。
若未来确需调整，在 `front/next.config.ts` 的 `redirects()` 里手写 301 即可（Next 内建，无新依赖）。

### 5.2 渲染策略总表

| 路由 | 策略 | `revalidate` | `generateStaticParams` | `dynamicParams` | 理由 |
|------|------|-------------|------------------------|-----------------|------|
| `/literacy` | ISR | `300` | — | — | 索引页，变更低频；5 分钟内的陈旧可接受，换 TTFB |
| `/literacy/[module]` | ISR + 预生成 | `600` | 全部已发布模块（≤10） | `true` | 模块词是主要流量入口，值得预热 |
| `/literacy/[module]/[lesson]` | **SSG + ISR** | `3600` | 全部已发布课时 | `true` | SEO/AISO 核心资产。爬虫命中静态 HTML，首字节最快 |

**为什么敢偏离全站 `force-dynamic` 的现状**：

现有页面用 `force-dynamic`（`literacy/page.tsx:59`、`usages/[id]/page.tsx:9`）是因为它们依赖登录态组件与实时计数。
伴学页不同——它的正文是本站原创、编辑发布后长期不变，页面上唯一的动态部分是「有用/收藏」计数，
而那部分本来就在客户端组件里二次拉取（`UsageUsefulCollect` 的 `useUseful`/`useFav` 是 `"use client"` + `useEffect`，
见 `front/src/lib/interactions.ts:22-53`）。**静态壳 + 客户端补动态**是这类页面的标准解，不牺牲任何交互。

**构建期不可达的兜底**：`content.ts:138` 明确注释「build 时 admin API 可能不可达」。
因此三处 `generateStaticParams` 必须**照抄 `usages/[id]/page.tsx:11-18` 的 try/catch 返回 `[]` 范式**，
再配 `dynamicParams = true`——构建期拿不到数据就退化为「首次访问按需渲染 + 之后进 ISR 缓存」，
构建不会失败，线上不会 404。这是本方案里最重要的一条工程保险。

```ts
// /literacy/[module]/[lesson]/page.tsx
export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams() {
  try {
    const { lessons } = await content.getLiteracyIndex();
    return lessons.map((l) => ({ module: l.moduleSlug, lesson: l.slug }));
  } catch {
    return [];   // 与 usages/[id]/page.tsx:16 同一范式
  }
}
```

### 5.3 PM2 部署对 ISR 的影响（必须确认项）

`ecosystem.config.js` 中 `front` 应用未设 `instances` / `exec_mode`，PM2 默认 **fork 单实例**——
ISR 的文件系统缓存（`.next/cache`）由单进程独占，不存在多实例缓存不一致问题。**当前部署形态下 ISR 可安全启用。**

⚠️ 若后续把 front 改成 `exec_mode: "cluster"` + `instances: "max"`，各 worker 的 ISR 缓存互不可见，
会出现「刷新一下新一下旧」。届时必须改用共享 cache handler 或退回 `force-dynamic`。
建议在 `ecosystem.config.js` 里显式写上 `exec_mode: "fork"` 并加注释，把这个隐含依赖变成显式约束。

### 5.4 generateMetadata 与结构化数据

#### 5.4.1 metadataBase 缺失（前置阻塞项）

`front/src/app/layout.tsx:29-36` 的 root metadata **没有 `metadataBase`**。
不补这一项，所有 `openGraph.url` / `alternates.canonical` 的相对路径都会被 Next 警告并降级。
必须先补：

```ts
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "https://eanavi.com"),
  // ...现有字段不动
};
```

（`NEXT_PUBLIC_SITE_ORIGIN` 已在 admin 侧使用，见 `admin/src/lib/http.ts:44`，前端复用同名变量即可，不新增配置项。）

#### 5.4.2 伴学页 metadata

```ts
export async function generateMetadata({ params }) {
  const { lesson } = await params;
  const l = await content.getLitLesson(lesson);
  if (!l) return { title: "伴学课 · 教AI导航" };
  return {
    title: `${l.title} · 教师伴学 · ${l.moduleTitle} · 教AI导航`,
    description: l.hook,
    keywords: l.keywords,
    alternates: { canonical: `/literacy/${l.moduleSlug}/${l.slug}` },
    openGraph: {
      type: "article",
      title: l.title,
      description: l.hook,
      url: `/literacy/${l.moduleSlug}/${l.slug}`,
    },
  };
}
```

**canonical 必须指向本站自身，绝不指向官方 URL。**
本站页面是原创导学，不是官方课程的副本；把 canonical 指过去等于主动声明「我是重复内容，别索引我」，
一次配置失误就能废掉全部 200 个页面。这条要写进 code review 检查清单。

#### 5.4.3 JSON-LD（AISO 的核心）

被豆包 / 元宝这类 AI 引用，靠的是**清晰的实体关系 + 可直接引述的问答对**。
关键建模原则：**页面本体是本站的 `LearningResource`，官方课程是它 `isBasedOn` 的外部 `Course`。**
反过来把页面标成官方 Course 既不实也不合规。

```jsonc
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "LearningResource",
      "@id": "https://eanavi.com/literacy/{module}/{lesson}#resource",
      "name": "{lesson.title} · 教师伴学导读",
      "description": "{lesson.hook}",
      "learningResourceType": "导学指南",
      "educationalLevel": "{lesson.stage}",
      "audience": { "@type": "EducationalAudience", "educationalRole": "teacher" },
      "inLanguage": "zh-CN",
      "datePublished": "{lesson.publishedAt}",
      "dateModified": "{lesson.updatedAt}",
      "publisher": { "@type": "Organization", "name": "教AI导航", "url": "https://eanavi.com" },
      "isBasedOn": {
        "@type": "Course",
        "name": "{lesson.title}",
        "url": "{lesson.officialUrl}",
        "provider": { "@type": "Organization", "name": "国家中小学智慧教育平台" }
      },
      "teaches": ["{...lesson.watchPoints}"],
      "hasPart": [
        { "@type": "HowTo", "name": "{sop.title}", "url": "https://eanavi.com/usages/{sop.id}" }
      ]
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "AI通识课", "item": "https://eanavi.com/literacy" },
        { "@type": "ListItem", "position": 2, "name": "{module.title}", "item": "https://eanavi.com/literacy/{module}" },
        { "@type": "ListItem", "position": 3, "name": "{lesson.title}" }
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        { "@type": "Question", "name": "{faq.q}",
          "acceptedAnswer": { "@type": "Answer", "text": "{faq.a}" } }
      ]
    }
  ]
}
```

三个实现要点：

1. `FAQPage` 节点**仅在 `faq.length > 0` 时输出**。空的 `mainEntity` 数组会被判为无效结构化数据。
   这也是为什么 `LitLesson.faq` 值得单列字段——它是 AI 引用率最高的部分，编辑必须逐条写，不能省。
2. `hasPart` 指向站内 `/usages/{id}`，把「官方原理课 → 本站 SOP」的闭环显式写进结构化数据。
   这正是本站相对官方平台的差异化，要让机器读懂。
3. JSON-LD 用 `<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }} />`
   在服务端渲染进 HTML。封装成 `front/src/components/literacy/LessonJsonLd.tsx`（≤80 行），不写进页面文件。

#### 5.4.4 sitemap 与 robots（全站缺失，必须补）

`front/src/app/` 下**既无 `sitemap.ts` 也无 `robots.ts`**（已核查全部 17 个 app 路由文件）。
新增 200 个页面而没有站点地图，发现周期会拖到数周。补两个文件，Next 内建，零依赖：

```
front/src/app/sitemap.ts   // 汇总 /literacy 全量 + 现有 /tool /usages /scenes
front/src/app/robots.ts    // Allow: /，指向 sitemap.xml
```

`sitemap.ts` 里对 literacy 部分设 `changeFrequency: "monthly"`、`priority: 0.8`（伴学页）/ `0.9`（模块页）。
同样要 try/catch——取数失败时返回仅含静态路由的最小 sitemap，不让构建挂掉。

### 5.5 发布即时生效（按需重新验证）

ISR 的 `revalidate` 最长 1 小时，编辑改完要等——体验差且容易让人误以为没保存。

**方案**：front 新增 `front/src/app/api/revalidate/route.ts`（≤50 行）：

```
POST /api/revalidate
  body: { secret: string, paths: string[] }
  → 校验 secret === process.env.REVALIDATE_SECRET
  → paths.forEach(p => revalidatePath(p))
  → 返回 { revalidated: true, paths }
```

admin 在 `PATCH /api/admin/literacy/lessons/[id]` 成功后异步 fire-and-forget 调用它，
传 `["/literacy", "/literacy/{module}", "/literacy/{module}/{lesson}", "/sitemap.xml"]`。
调用失败只记日志、不影响保存成功——内容已经落库，最坏情况是 1 小时后自然过期。

`revalidatePath` 是 `next/cache` 内建，**不引入任何新依赖**。
新增环境变量 `REVALIDATE_SECRET`（front 与 admin 各配一份，值相同）。

### 5.6 页面组件划分（守 300 行上限）

```
front/src/app/literacy/
  page.tsx                                  // 索引页，≤150 行
  [module]/page.tsx                         // 模块页，≤150 行
  [module]/[lesson]/page.tsx                // 伴学页，≤180 行（只做编排）
front/src/components/literacy/
  ModuleCard.tsx            // 模块卡（复用于索引页）
  LessonCard.tsx            // 课时卡
  OfficialCourseCta.tsx     // 「去官方学」按钮 + linkStatus 三态降级 + 外链埋点（"use client"）
  OfficialSourceNote.tsx    // 常驻来源声明（合规组件，全页面强制引入）
  GuideSection.tsx          // 导学正文 + 看点清单
  LinkedSopList.tsx         // 关联 SOP 列表，链接 /usages/{id}
  LessonJsonLd.tsx          // 结构化数据
  LessonInteractions.tsx    // 有用/收藏（"use client"，复用 useUseful/useFav）
```

图标一律 `<Icon name="..." size={} />`（`front/src/lib/icons.tsx:58`），
颜色一律走 `globals.css` 既有 CSS 变量（如 `var(--muted)`，参考 `usages/[id]/page.tsx:99`），
**不出现任何硬编码色值、不出现 emoji、不使用紫→粉渐变**。
---

## 6. 后台管理页设计

### 6.1 页面清单

沿用 `admin/src/app/admin/(protected)/` 下现有范式（`"use client"` + `useEffect` 拉 `/api/admin/*` + `.tbl` 表格 + `.btn` 按钮，
见 `sops/page.tsx:1-5,33-43,96-135`）：

```
admin/src/app/admin/(protected)/literacy/
  page.tsx                    // 总览：模块列表（左）+ 课时列表（右），≤220 行
  modules/[id]/page.tsx       // 模块编辑，≤180 行
  lessons/[id]/page.tsx       // 伴学课编辑器（核心），需拆子组件，见 6.3
  links/page.tsx              // 外链健康总览，≤160 行
  _components/
    LessonMetaForm.tsx        // 官方元信息表单
    LessonGuideForm.tsx       // 本站原创导学表单（含字数计）
    LessonFaqEditor.tsx       // FAQ 增删改（JSON 数组编辑器）
    SopPicker.tsx             // 关联 SOP 选择器
    LinkStatusBadge.tsx       // 四态徽标，供 page/links 复用
```

`Sidebar.tsx:6-28` 的 `NAV` 在「内容」组内、`SOP 编辑器` 之后插入：

```ts
{ href: "/admin/literacy", label: "AI通识课" },
```

（`isActive` 用 `pathname.startsWith(href)`，`/admin/literacy/lessons/xxx` 会自动高亮，无需改判定逻辑。）

### 6.2 CRUD 交互要点

**模块**
- 新建即刻落库为 `draft` 并跳转编辑页（照抄 `sops/page.tsx:45-56` 的 `create()` → `router.push` 模式）
- `slug` 只在 `draft` 状态可编辑；一旦 `published` 置灰（改 slug = 断链）
- `icon` 字段用**下拉选择器**而非自由输入，选项来自一份约 40 个的 Phosphor 白名单常量。
  自由输入必然会出现拼错的图标名，前端 `Icon` 组件对未知名只会 `console.warn` 后返回 `null`（`icons.tsx:87-92`），
  线上表现是「图标凭空消失」且没有任何报错——这种静默失败必须在录入端堵死。
- 删除前置校验：其下有课时则 `409` + 人话提示

**伴学课**
- 列表支持按 模块 / 来源 / 状态 / 链接状态 四个维度筛选
- 新建时 `source` 必选（`official` / `original` / `ugc`），选 `official` 才展开官方元信息区
- **发布前置校验（服务端强制，不只是前端提示）**：

  | 校验项 | 阈值 | 理由 |
  |--------|------|------|
  | `hook` 非空 | 20–80 字 | 卡片摘要与 meta description 都靠它 |
  | `guideIntro` 字数 | **≥ 400 字** | 防止批量灌水成低质聚合页，见 §9.5 |
  | `afterAction` 非空 | ≥ 30 字 | 「学完→动手」闭环的过渡文案，是本站差异化 |
  | `officialUrl` 格式 | `source=official` 时必填且 https | 桥接的前提 |
  | 关联 SOP | ≥ 1 条 | 没有 SOP 的伴学页就只是个外链导航，没有存在价值 |
  | `faq` | ≥ 2 条 | 结构化数据的 AI 引用抓手 |

  校验不通过时 `fail(422, "...")`，后台在「发布」按钮旁列出未达标项。
  **这不是形式主义**：SEO 冷启动阶段，200 个单薄页面会拖累整站权重，一个够硬的门槛比事后清理便宜十倍。

- 保存成功后 fire-and-forget 调用 front 的 `/api/revalidate`（§5.5）
- 「立即检查链接」按钮 → `POST /api/admin/literacy/lessons/[id]/check-link`，同步返回结果并刷新徽标
- 已发布课时的 `moduleId` 下拉置灰（§5.1 的 URL 稳定性约定）

**关联 SOP 选择器（`SopPicker.tsx`）**
- 数据源复用 `GET /api/admin/sops`（`api/admin/sops/route.ts:9-30`，已返回 `id/toolName/title/stepCount`，无需新端点）
- 交互：按工具分组的搜索下拉 + 已选列表（可拖拽排序、可填 `reason`）
- 提交走 `PUT /api/admin/literacy/lessons/[id]/sops`，body 为 `{ items: [{sopPathId, order, reason}] }` **整集合替换**
- 存的是 `sopPathId`（= `SopPath.id`），选择器里同时显示该 SOP 的公开链接 `/usages/{usageId || id}` 供编辑核对

### 6.3 伴学课编辑器的分层

单页会超 300 行，按职责下沉：

```
lessons/[id]/page.tsx        // 只做：拉数据 / 组装表单 state / 提交 / 错误提示（≤180 行）
  ├ LessonMetaForm           // 官方元信息（title/url/courseId/stage/durationMin/fallbackUrl）
  ├ LessonGuideForm          // hook/guideIntro/watchPoints/afterAction/editorNote + 实时字数
  ├ LessonFaqEditor          // faq 数组增删改
  ├ SopPicker                // 关联 SOP
  └ LessonPublishBar         // 状态切换 + 校验结果列表 + 保存
```

服务端校验逻辑单独放 `admin/src/lib/literacy/validate.ts`（≤120 行），
被 `PATCH /lessons/[id]` 与后台预检接口共用——**同一份规则，不写两遍**。

### 6.4 RBAC 落地

- `requireAdmin("literacy", "read" | "write" | "delete")` 守住全部 `/api/admin/literacy/*`
- `Sidebar` 不做权限过滤（现有实现也没做，`Sidebar.tsx:48-61` 是全量渲染），
  无权限用户点进去由 API 返回 403、页面显示「无权限」——与现状一致，不引入新模式
- seed 补 `editor` 角色的 `literacy:read` / `literacy:write` 两条 `RolePermission`
- `reviewer` 角色只给 `literacy:read`

### 6.5 数据看板接管

`admin/src/app/admin/(protected)/analytics/page.tsx` 现在是 `ComingSoon` 占位（全文 10 行），
其描述写着「依赖 Phase 3 的真实互动数据」。§8 的埋点方案落地后，这个页面就有数据可读了：

- 从 `EventDaily` 读近 30 天，四个核心卡片：伴学页 PV / 官方外链点击数 / **外链点击率** / SOP 跳转数
- 一张「课时排行」表：按 `officialClicks` 降序，暴露哪些课真的把人送出去了
- 一张「零点击课时」表：`viewCount > 50 && officialClicks === 0` 的课时——这些要么导学文案没说服力，要么链接坏了

这是本方案的附带收益：**通识课板块顺手把全站第一个真实行为看板做起来了。**
---

## 7. 外链健康检查机制

### 7.1 问题的真实形状

国家中小学智慧教育平台是 **JS 动态渲染的 SPA**。这带来一个反直觉的结论：

> **HTTP 200 不代表课程还在。** SPA 的前端路由对不存在的资源通常仍返回 200 + 空壳 HTML。

所以「fetch 一下看状态码」这种朴素做法会漏报——课程下架了，检查器还在报 ok。
必须承认：**在不引入无头浏览器的前提下，无法 100% 判定课程是否存在。**
（引入 Playwright 意味着服务器多装一份 Chromium + 内存占用翻倍，1-2 人团队维护不起，明确排除。）

因此本方案的目标不是「精确判定」，而是**用零依赖手段捕获高置信度的失效信号，其余交给用户反馈兜底**。

### 7.2 三级判定

对每条 `source === "official"` 且 `status === "published"` 的课时：

```
请求：GET officialUrl
  method: GET（HEAD 在多数 CDN 上不可靠，直接 GET 但只读前 64KB 后 abort）
  redirect: "manual"          // 手动跟随，才能捕获重定向落点
  signal: AbortSignal.timeout(8000)
  headers: { "User-Agent": "eanavi-linkcheck/1.0 (+https://eanavi.com/about)" }
```

| 判定 | 条件 | 处置 |
|------|------|------|
| `ok` | 2xx，且无重定向（或重定向后仍同域同 path） | `linkFailCount = 0` |
| `warn` | 3xx 到**不同 path**（改版信号）／ 单次超时 ／ 429 | 记 `linkFinalUrl`，`linkFailCount += 1`，后台黄标 |
| `broken` | 4xx / 5xx / DNS 失败 / 连续 `linkFailCount >= 3` | 后台红标 + 仪表盘计数 |

**连续 3 次才置 broken** 是关键的抖动容错：单次网络波动、CDN 限流、平台夜间维护都不该让页面立刻降级。
每天 1 次检查 → 连续 3 天失败才降级，误报窗口 3 天，可接受。

补充一条**廉价的内容指纹**（不用无头浏览器）：把返回 HTML 的前 64KB 做 `sha256` 存 `props`，
若某天全站 80% 以上课时的指纹同时突变 → 平台整站改版，触发人工核查告警。
单条指纹变化没有意义（SPA 壳子会带随机 hash），但**批量同时变化**是极强的改版信号。这条几乎零成本。

### 7.3 调度：不引入任何新依赖

排除的方案：`node-cron`（多一个依赖 + 与 PM2 重启周期耦合）、`@vercel/cron`（不适用自建服务器）。

**采用：系统 crontab + curl 打受保护端点。**

```
# 服务器 crontab -e
5 3 * * * curl -fsS -m 900 -X POST "http://127.0.0.1:3001/api/admin/literacy/link-check?token=$LINKCHECK_TOKEN" >> /srv/app/ai-navigation-pro/logs/linkcheck.log 2>&1
20 3 * * * curl -fsS -m 300 -X POST "http://127.0.0.1:3001/api/admin/events/rollup?token=$LINKCHECK_TOKEN" >> /srv/app/ai-navigation-pro/logs/rollup.log 2>&1
```

- 走 `127.0.0.1:3001` 内网直连 admin，不经 Nginx，不暴露公网
- 端点鉴权用**独立的 `LINKCHECK_TOKEN` 环境变量**，不走 `requireAdmin`（cron 没有会话 cookie）
- 端点内部先校验 token，再执行；token 不匹配返回 401
- 新增环境变量 1 个，新增依赖 0 个

### 7.4 执行策略（别把自己搞成爬虫）

```
- 只检查 source=official && status=published 的课时
- 串行执行，每条之间 sleep 300ms（200 条 ≈ 60 秒 + 网络耗时）
- 单次运行硬上限 15 分钟，超时中止并记录进度
- 每条独立 try/catch，单条失败不影响后续
- 全程只发 GET、只读 header + 前 64KB，不解析、不存储任何页面内容（合规）
```

服务层放 `admin/src/lib/literacy/link-check.ts`（≤150 行），
被「定时全量」与「后台单条即时检查」两个入口共用。

### 7.5 前端降级展示（`OfficialCourseCta.tsx`）

**核心原则：外链坏了，页面不能跟着废。** 本站原创的导学文案 + 关联 SOP 依然完整，页面仍有独立价值。

| `linkStatus` | 展示 |
|--------------|------|
| `ok` / `unchecked` | 主按钮「去官方平台学这节课」`<Icon name="ArrowSquareOut" />`，`target="_blank" rel="noopener noreferrer"`，点击发 `lit_official_click` |
| `warn` | 主按钮照常，下方一行浅色提示：「官方页面近期有调整，若打不开请从 {fallbackUrl} 进入《学AI》栏目查找」 |
| `broken` | **不渲染主按钮**。改为提示卡：「这节课的官方直达链接暂时失效（{archiveNote}）。你可以先看下面的导学要点，再从《学AI》栏目自行查找。」+ 次级按钮指向 `fallbackUrl` |

三条硬约束：

1. **任何状态下都不 404、不 `notFound()`。** 页面已被搜索引擎收录，返回 404 等于自己删自己的索引。
2. **任何状态下都不隐藏导学正文与关联 SOP。** 那是本站原创资产，与外链存活无关。
3. `broken` 状态下页面仍输出 JSON-LD，但 `isBasedOn.url` 换成 `fallbackUrl`（不再声明一个死链是数据来源）。

后台侧：`/admin/literacy/links` 列出全部 `warn` / `broken`，按失败次数降序，一键跳转编辑页更新 URL。
仪表盘（`/admin` 首页）加一个「失效外链 N 条」的红色计数——让问题主动找人，而不是等人去找。
---

## 8. 埋点方案

### 8.1 先修正审计结论的边界

审计说「全站零行为数据」。实际核查后需要精确化：

- **登录态互动已经打通**：`front/src/lib/interactions.ts` 的 `useUseful` / `useFav` / `useRating` 均已对接
  `/api/me/useful`、`/api/me/favorites`、`/api/me/ratings`，`UsageUsefulCollect.tsx:27-53` 有完整点击逻辑与服务端计数。
  `api/me/useful/route.ts:65-91` 是带事务的正确实现。
- **真正为零的是匿名行为数据**：页面浏览、外链点击、SOP 跳转、复制/下载——这些不要求登录，
  现有 `Useful` / `Favorite` 表（`schema.prisma:130,153`，均有 `userId` 非空外键）**结构上装不下**。

所以方案是**双轨**，而不是把什么都塞进现有表：

| 数据类型 | 载体 | 理由 |
|----------|------|------|
| 登录用户的表态（有用/收藏） | 复用 `Useful` / `Favorite`，扩 `refType="lesson"` | 需要唯一约束、需要回显「我标过」、需要个人中心聚合 |
| 匿名行为流（view/click/copy） | 新表 `EventLog` | 无登录要求、高频、只做聚合统计、不需要唯一性 |

### 8.2 复用现有多态表（登录态）

`Useful` 与 `Favorite` 的 `@@unique([userId, refType, refId])` 天然支持第三种 refType，**表结构零改动**。
需要改的只有三处校验与计数分支：

1. `api/me/useful/route.ts:42-43`
   `if (refType !== "tool" && refType !== "path")` → 放开为 `["tool","path","lesson"].includes(refType)`
2. 同文件 `:49-63` 的资源解析分支增加 `lesson`：
   `db.litLesson.findFirst({ where: { OR: [{ id: refId }, { slug: refId }] } })`，计数字段 `usefulCount`
   （与 tool 用 slug、path 用 usageId 的既有风格一致，lesson 的 `refId` **统一存 `slug`**）
3. `api/me/favorites/route.ts` 同样两处，计数落 `LitLesson.collectCount`

前端直接复用现成 hook，零新代码：`useUseful(lesson.slug, "lesson")`、`useFav("lesson", lesson.slug)`
（`interactions.ts:76` 的 `refType` 参数已是可选入参，签名不用改，只需放宽联合类型）。

### 8.3 匿名行为事件清单

| 事件名 | refType | refId | props | 说明 |
|--------|---------|-------|-------|------|
| `lit_module_view` | module | moduleSlug | `{}` | 模块页浏览 |
| `lit_lesson_view` | lesson | lessonSlug | `{ module, source, stage }` | **伴学页浏览** |
| `lit_official_click` | lesson | lessonSlug | `{ linkStatus }` | **官方课外链点击（北极星指标）** |
| `lit_sop_click` | lesson | lessonSlug | `{ sopId, sopTitle }` | **关联 SOP 跳转** |
| `lit_asset_copy` | lesson | lessonSlug | `{ assetKey }` | **复制导学要点 / 提示词** |
| `lit_asset_download` | lesson | lessonSlug | `{ assetKey }` | **下载资产**（如打印版学习单） |
| `lit_fallback_click` | lesson | lessonSlug | `{}` | 外链失效时点了兜底入口 |
| `lit_useful_toggle` | lesson | lessonSlug | `{ on }` | 与 `Useful` 写入并行发一条，用于漏斗对齐 |

**props 里不放 URL 全文**（`officialUrl` 可由 refId 反查，重复存储只是浪费 SQLite 空间）。

北极星指标定义清楚：**外链点击率 = `lit_official_click` uniques / `lit_lesson_view` uniques**。
这个数字直接回答「导学桥接层到底有没有把人送到官方课」——桥接模型成立与否，只看它。

### 8.4 前端埋点缝 `front/src/lib/track.ts`（≤120 行）

```ts
// 匿名标识：localStorage 一个 UUID，不含任何个人信息，不跨站。
const AID_KEY = "eanavi_aid";

interface TrackEvent { name: string; refType: string; refId: string; props?: Record<string, unknown>; }

let queue: TrackEvent[] = [];

export function track(e: TrackEvent): void        // 入队，不立即发
export function trackNow(e: TrackEvent): void     // 立即 sendBeacon（外链点击专用）
function flush(): void                            // 批量发送，最多 20 条/次
```

三条设计要点：

1. **外链点击必须用 `navigator.sendBeacon` 且立即发。**
   用 `fetch` 会在页面跳走时被浏览器取消，外链点击数会系统性偏低——而这恰好是北极星指标。
   `sendBeacon` 由浏览器在后台保证投递，不阻塞跳转，不需要 `e.preventDefault()` + `setTimeout` 那种脏招。
2. **普通事件入队，在 `visibilitychange`（hidden）与 `pagehide` 时批量 flush。**
   减少请求数，对 SQLite 的写压力从「每次交互一写」降到「每次会话若干写」。
3. **降级静默。** `sendBeacon` 不可用或请求失败一律吞掉，绝不影响页面功能。埋点永远不能是故障源。

隐私：只存 `anonId` + 截断到 120 字符的 UA，**不存 IP、不存 referer 全文、不接第三方 SDK**。
页脚隐私说明加一句站内统计的告知。

### 8.5 上报端点 `POST /api/events`

放在 admin 侧（数据库在那边），`admin/src/app/api/events/route.ts`（≤120 行）：

```
POST /api/events
  headers: Content-Type: application/json（sendBeacon 用 Blob 指定该类型即可携带 CORS 简单请求）
  body: { anonId: string, events: TrackEvent[] }   // events 最多 20 条，超出截断
  → 校验 name 在白名单内（枚举常量，拒绝任意事件名，防垃圾写入）
  → 30 分钟内同 (anonId, name, refId) 的 view 类事件去重（查 EventLog 最近一条，走 anonId 索引）
  → db.eventLog.createMany(...)
  → 对 lit_lesson_view 追加 db.litLesson.updateMany({ where: { slug }, data: { viewCount: { increment: 1 } } })
  → 对 lit_official_click 追加 officialClicks 自增
  → 恒定返回 204，不返回任何数据
  export async function OPTIONS() { return new Response(null, { status: 204, headers: corsAuth() }); }
```

关键实现约束：

- **用 `updateMany` 而不是 `update`**：`update` 在 slug 不存在时会抛 `P2025`，`updateMany` 静默匹配 0 行。
  埋点接口不应该因为一个脏 refId 就 500。
- **不进事务**：`createMany` 与计数自增分开执行。SQLite 是单写者模型，
  埋点事务会与后台内容编辑抢写锁（这正是 `api/me/useful/route.ts:70,82` 用事务是对的、而埋点用事务是错的原因）。
  计数少一两次无所谓，看板真值以 `EventDaily` 从 raw 表聚合为准。
- CORS 用 `corsAuth()`（`http.ts:49-56`，已允许 POST + 预检），不新增 CORS 配置。

### 8.6 聚合与保留

`POST /api/admin/events/rollup?token=...`，每日 03:20 由 crontab 触发（§7.3）：

```
1. 取昨日 EventLog，按 (day, name, refType, refId) 分组
   → count = 行数，uniques = distinct anonId 数
   → upsert 进 EventDaily（@@unique([day,name,refType,refId]) 保证幂等，重跑安全）
2. 删除 createdAt < now - 30 天 的 EventLog
3. 执行 VACUUM（SQLite 删行不自动回收空间，不 VACUUM 文件只涨不缩）
```

保留 30 天 raw 的量级估算：日 PV 2000 × 平均 3 事件 ≈ 6000 行/天 × 30 ≈ 18 万行。
单行约 200 字节 → 约 36MB。SQLite 完全无压力。

看板只读 `EventDaily`（30 天 × 8 事件 × 200 课时上限 ≈ 4.8 万行，带 `day` 索引），
查询永远不扫 raw 表。
---

## 9. 风险与技术债

按「会不会真的炸」排序，每条都给触发条件和处置动作，不写空话。

### 9.1 SQLite 单写者锁 —— 最高风险

SQLite 同一时刻只允许一个写事务。埋点是高频写，后台内容编辑也是写，两者会互相阻塞（`SQLITE_BUSY`）。

| 缓解措施 | 落地方式 |
|----------|----------|
| 开启 WAL 模式 | 部署脚本执行 `PRAGMA journal_mode=WAL;`（读写不互斥，写并发显著改善）。这是**上线前必做项**，一条命令 |
| 设置 busy_timeout | `PRAGMA busy_timeout=5000;`，遇锁自动重试 5 秒而非立刻报错 |
| 埋点批量写 + 不进事务 | §8.4 / §8.5 已设计 |
| 埋点与内容写错峰 | rollup / VACUUM 放凌晨 03:20 |

**迁移 Postgres 的量化触发条件**（提前写死，避免届时扯皮）：
满足任一即启动迁移 —— ①日 PV > 10000；②`EventLog` 日增 > 5 万行；③日志出现 `SQLITE_BUSY` > 10 次/天；④需要多实例部署。
schema 注释（`schema.prisma:4`）已写明迁移路径：改 provider + 把 String JSON 列改 Json 类型。
本方案新增的 5 张表全部遵守同一约定，不增加迁移难度。

### 9.2 SQLite 无 JSON 查询能力

`keywords` / `watchPoints` / `faq` 都是 String 存 JSON，**无法在 SQL 层按内容筛选**。

- 影响：做不了「按关键词筛课时」的服务端过滤，只能全量取回应用层 `filter`
- MVP 判定：**接受**。课时数 < 200，全量取回 + 内存过滤耗时 < 5ms
- 触发重构：课时数 > 500 或需要关键词聚合页时，加一张 `LitLessonKeyword(lessonId, keyword)` 关系表
- 现有代码已是同样处理（`api/content/usages/route.ts:18-20` 就是取全量再 `filter`），本方案不引入新的坏味道

### 9.3 外链依赖 —— 不可控的外部风险

国家平台改版、课程下架、URL 结构调整，全部不在我们控制内。

- 已做缓解：`officialCourseId`（改版后重新定位）+ `fallbackUrl`（栏目页兜底）+ 三级 `linkStatus` 降级 + 每日检查（§7）
- 未消除的残余风险：平台整站换域名 / 《学AI》栏目整体下线
- 处置：`fallbackUrl` 逐条可编辑，最坏情况批量改为平台首页；页面主体（本站原创导学 + SOP）不受影响
- **架构上的根本对冲**：页面价值不建立在外链之上。`source` 字段留了 `original` / `ugc` 两个值——
  当官方内容不可用时，同一套模块/课时结构可以直接承载自研或教师共创内容，**不需要改任何 schema 和路由**。
  这是这个数据模型最重要的一处冗余设计。

### 9.4 SEO 冷启动

新增约 200 个页面，站点权重低，收录慢。

- 已做：sitemap + robots（§5.4.4，全站原本缺失）、JSON-LD 三元组（§5.4.3）、SSG 静态 HTML（§5.2）
- 未解决：外链与品牌词积累，非技术能解决
- 技术侧能做且必须做的：**发布门槛**（§6.2 的 `guideIntro ≥ 400 字` + `FAQ ≥ 2 条` + `关联 SOP ≥ 1 条`）。
  200 个 200 字的页面会被判定为低质聚合，反而拉低整站权重——**宁可 40 个够硬的页面，不要 200 个凑数的**。
  建议首批只上 1 个模块约 10 节课，观察 4 周收录与点击率再放量。

### 9.5 canonical 配置错误（一次失误废掉整个板块）

把 `alternates.canonical` 指向官方 URL，会让全部伴学页被判为重复内容而不索引。
这是本方案唯一「一行代码毁掉全部工作」的地方。

- 处置：写进 code review 检查清单；在 `generateMetadata` 的 canonical 行上方留固定注释说明；
  上线后用 `curl` 抽查 3 个页面的 `<link rel="canonical">` 确认指向 `eanavi.com`

### 9.6 ISR 与部署形态耦合

ISR 依赖 `.next/cache` 文件缓存 + PM2 单实例（§5.3 已核查 `ecosystem.config.js` 为默认 fork 模式）。

- 隐患：某天有人为了「提高性能」把 front 改成 cluster 多实例，ISR 缓存立刻不一致，
  表现为「刷新一下新一下旧」，且极难排查
- 处置：在 `ecosystem.config.js` 的 front 配置里**显式写上** `exec_mode: "fork"` 并加注释
  「front 使用 ISR，缓存基于本地文件系统，改 cluster 前必须先改造 cache handler」

### 9.7 构建期 admin 不可达

`content.ts:138` 已注明这个场景。三处 `generateStaticParams` 全部 try/catch 返回 `[]`（§5.2），
配 `dynamicParams = true` 后退化为按需渲染，构建不失败。

- 残余影响：首次访问该页面的用户会等一次 SSR（约 200–400ms），之后进缓存
- 判定：可接受。若要根治，需在部署流程里加「先起 admin、健康检查通过、再 build front」的顺序约束——建议加进部署脚本

### 9.8 content.ts / serialize.ts 拆包的一次性风险

`content.ts` → `content/index.ts` 的迁移必须在**单个 commit** 内完成（文件与同名目录不能共存）。
拆错会导致全站 `@/lib/content` 解析失败、构建直接红。

- 处置：拆包单独一个 PR，只做移动不做逻辑改动，`npm run build` 通过后再合；literacy 功能在其后的 PR 里加

### 9.9 已知待修的存量问题（本次顺带解决）

| 问题 | 位置 | 处置 |
|------|------|------|
| 「配套 SOP」链接指向工具页而非 SOP 详情 | `front/src/app/literacy/page.tsx:129` | 新模型下统一为 `/usages/{usageId \|\| id}`，随迁移消失 |
| 全站无 sitemap.ts / robots.ts | `front/src/app/` | §5.4.4 补齐 |
| root metadata 无 metadataBase | `front/src/app/layout.tsx:29-36` | §5.4.1 补齐 |
| 数据看板是 ComingSoon 占位 | `admin/.../analytics/page.tsx:1-10` | §6.5 接管 |
| `Useful`/`Favorite` refType 硬编码只认 tool/path | `api/me/useful/route.ts:42` | §8.2 放开为白名单数组 |

### 9.10 不做的事（明确划界，防止范围蔓延）

| 不做 | 理由 |
|------|------|
| 爬虫抓取官方课程 | 平台 JS 渲染 + 合规争议，用户已拍板 |
| 无头浏览器做链接探活 | 服务器资源与运维成本不匹配 1-2 人团队（§7.1） |
| 引入第三方统计 SDK | 数据要留在自己库里才能进后台看板，且教育场景对第三方 SDK 敏感 |
| 课时级评论 / 讨论区 | 内容量不足以支撑社区，且带来审核成本。`source="ugc"` 字段留了口子，等有量再说 |
| 课程进度追踪 / 学习证书 | 官方课在站外播放，我们拿不到真实完播数据，做了就是假数据 |
| API 分页包装 | 内容量 < 200（§3.3），等破 300 再上 v2 |
| 课时 URL 重定向 alias 表 | 用运营约定（已发布不改模块）替代，成本低两个数量级（§5.1） |

---

## 10. 决策记录（ADR 摘要）

| 编号 | 决策 | 状态 |
|------|------|------|
| ADR-001 | `LitLessonSop` 外键指向 `SopPath.id`，对外链接用 `usageId \|\| id` 现算 | Accepted |
| ADR-002 | `/api/content/literacy/*` 沿用裸响应，不采用 `{code,data,message}` 包装 | Accepted（显式偏离通用规范，理由见 §3.1） |
| ADR-003 | 列表端点不做分页，硬上限 500 条 | Accepted |
| ADR-004 | 伴学页采用 SSG + ISR，偏离全站 `force-dynamic` 现状 | Accepted |
| ADR-005 | 新增 RBAC 资源 `literacy`，不复用 `sops` | Accepted |
| ADR-006 | 链接检查用 crontab + curl，不引入 cron 库、不引入无头浏览器 | Accepted |
| ADR-007 | 匿名行为走新表 `EventLog`，登录态表态复用 `Useful`/`Favorite` | Accepted |
| ADR-008 | `content.ts` / `serialize.ts` 拆为目录 + `index.ts` re-export，调用方零改动 | Accepted |

## 11. 新增依赖与配置清单

**新增 npm 依赖：0 个。** 全部能力来自现有栈（Next.js 内建 `revalidatePath` / `sitemap` / `robots`、
浏览器内建 `navigator.sendBeacon` / `AbortSignal.timeout`、Prisma、系统 crontab）。

**新增环境变量：2 个**

| 变量 | 位置 | 用途 |
|------|------|------|
| `REVALIDATE_SECRET` | front + admin（同值） | 按需重新验证的调用凭据（§5.5） |
| `LINKCHECK_TOKEN` | admin | crontab 触发链接检查 / 埋点聚合的凭据（§7.3） |

**新增 npm script：1 个** —— `db:seed:literacy`（§2.1）

**部署侧一次性动作：3 项**
1. `PRAGMA journal_mode=WAL;` + `PRAGMA busy_timeout=5000;`（§9.1）
2. crontab 两条（§7.3）
3. `ecosystem.config.js` 的 front 显式加 `exec_mode: "fork"`（§9.6）
