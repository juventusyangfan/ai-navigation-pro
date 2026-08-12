# AI 通识课桥接国家平台《学AI》· 开发方案（含 Spec）

> 版本 v1.0 ｜ 汇编：项目总监（大湾区靓仔）｜ 日期：2026-08-07
> 战略基线：国家平台出原理课，本站出 SOP 做导学桥接层；本站只做"导学桥接层"，不生产/不镜像课程内容。
> 配套底层文档（均已落盘，本方案为它们的合并契约）：
> - 需求规格：`通识课桥接-需求规格.md`（PM，47 条 AC）
> - 技术架构：`AI通识课桥接-技术架构方案.md`（架构师，8 ADR）
> - UI/UX 设计：`design/AI通识课桥接板块-UIUX设计方案.md`（设计师）

---

## 0. 结论先行

本方案在**完全复用现有技术栈（Next.js App Router + Prisma + SQLite + Phosphor `<Icon>` + Claymorphism 设计系统）**的前提下，把 `/literacy` 从一个 55 行硬编码常量数组，升级为**可后台运营的三级导学资产**（索引页 → 模块页 → 伴学页），新增 3 张内容表 + 2 张行为表，**新增 npm 依赖 0 个**。

三条不可让步的架构红线（写进数据模型与门禁，不是写在 review 清单里）：
1. **不存官方正文**——schema 层不设任何可容纳课程正文的字段。
2. **canonical 指向本站自己**，不指向官方——否则主动放弃全部伴学页索引权。
3. **外链失效 ≠ 页面失效**——官方链接 broken 时页面照常渲染，只降级掉"去官方学"主按钮。

**已核实的三项用户决策**（来自前期确认，本方案据此落地）：
- 数据录入 = **admin 后台手工录入**（不做爬虫）
- 页面深度 = **每条官方课一个独立伴学页**（`/literacy/[module]/[lesson]`），作为 SEO/AISO 核心资产
- 交付物 = **本开发方案文档（含 Spec）**，本次不写实现代码

---

## 1. Spec（规格即契约）

### 1.1 产品定义
- **一句话描述**：面向中小学教师的 AI 通识课导学桥接层——国家平台讲原理，本站配 SOP，拼成"学完原理→立刻练"的闭环。
- **目标用户**：中小学教师（含备课、班主任、教研场景），不要求登录即可浏览与点击。
- **核心问题**：教师想学 AI 但官方课"看了不知道怎么用"，本站补"为什么看 + 看完练什么"。

### 1.2 MVP 范围（锁定——不在此列表的功能一律不做）

| 优先级 | 功能 | 验收摘要 | 来源 |
|--------|------|----------|------|
| P0 | 三级导学页（索引/模块/伴学） | 路由可达、SSR/ISR 正常、构建不失败 | 架构 §5 |
| P0 | 伴学页关联站内 SOP（链接修对） | 链接指向 `/usages/{usageId||id}`，非工具页 | AC-17 / 架构 ADR-001 |
| P0 | 外链桥接 + 诚实来源声明 | 来源说明句常驻、域名可见、target=_blank | 设计 §5 / AC |
| P0 | 外链失效降级 | 四级阶梯 L0–L3，页面不 404、不丢导学正文 | 架构 §7 / 设计 §8 |
| P0 | 匿名行为埋点通道 | `POST /api/events` + `EventLog`，北极星可算 | 架构 §8 / PM |
| P0 | 后台 CRUD（模块/课时/关联 SOP） | 受 `literacy` RBAC 守护，发布硬校验 | 架构 §6 |
| P0 | SEO 基建（sitemap/robots/metadataBase/JSON-LD） | 全站原本缺失，本次补齐 | 架构 §5.4 |
| P0 | `/compliance` 合规声明页 + Footer 死链修复 | 修 `Footer.tsx:35` 的 `#` 死链（AC-43 上线阻断项） | 本方案 §2.2-A1 |
| P1 | 外链健康检查（crontab + GET 探活） | 三级判定、连续 3 次才置 broken | 架构 §7 |
| P1 | 行为看板（首屏真实数据） | 外链点击率 + SOP 跳转数 + 零点击课时表 | 架构 §6.5 |
| P1 | 发布即时 revalidate | 编辑保存后 fire-and-forget 调 front `/api/revalidate` | 架构 §5.5 |

### 1.3 明确不做（Out-of-Scope——锁定）

| 不做 | 原因 | 何时考虑 |
|------|------|----------|
| 爬虫抓取官方课程 | 平台 JS 渲染 + 合规争议，用户已拍板 | 永不（桥接而非搬运） |
| 无头浏览器做链接探活 | 服务器资源/运维成本不匹配 1-2 人团队 | 课时量破千且误报成痛点时 |
| 第三方统计 SDK | 数据要进自己库才能进后台看板，教育场景敏感 | 永不 |
| 课时级评论/讨论区 | 内容量不足以支撑社区 + 审核成本 | `source=ugc` 有量后 |
| 课程进度/学习证书 | 官方课在站外播放，拿不到完播，做了是假数据 | 永不 |
| 列表 API 分页包装 | 内容量 < 200 | 破 300 再上 v2 |
| 课时 URL 重定向 alias 表 | 用运营约定（已发布不改模块）替代 | 确需改模块时手写 301 |

### 1.4 技术架构（版本锚定）

| 层 | 技术 | 选型理由 |
|----|------|----------|
| 前端 | Next.js App Router + TypeScript | 现有栈，复用 `content.ts` 取数缝 |
| 前端 UI | Tailwind v4 + `globals.css` Claymorphism Token | 现有设计系统，不引第二品牌色 |
| 图标 | `@phosphor-icons/react` + `front/src/lib/icons.tsx` 的 `<Icon name size weight>` | **P0 锁定一套，全站唯一图标入口，禁 emoji（ADR-图标）** |
| 后端/管理 | Next.js + Prisma + SQLite | 现有 admin 栈，DB 在 admin 侧 |
| 部署 | PM2 fork 单实例 + Nginx（腾讯云轻量） | 现有 `ecosystem.config.js`，ISR 依赖单实例缓存 |
| 渲染 | 伴学页 SSG+ISR(3600) / 模块页 ISR(600) / 索引页 ISR(300) | 偏离全站 `force-dynamic`，理由见架构 §5.2 |
| 认证 | 现有 `requireAdmin(resource, action)` + `LINKCHECK_TOKEN` | 复用，cron 无会话用独立 token |

### 1.5 数据模型（锁定）

**新增 3 张内容表**（`admin/prisma/schema.prisma`，数组/JSON 仍以 `String(JSON.stringify)` 存储，遵守 SQLite 约束）：

- `LitModule`：模块（slug 唯一、icon 用 Phosphor 名、toolSlugs/keywords JSON 串、status draft|published）。
- `LitLesson`：伴学课（slug 全局唯一、source official|original|ugc、officialUrl/provider/courseId/column/stage/durationMin、本站原创导学 hook/guideIntro/watchPoints/afterAction/editorNote/faq、外链健康 linkStatus/linkCheckedAt/linkHttpCode/linkFinalUrl/linkFailCount/fallbackUrl/archiveNote、计数 viewCount/officialClicks/usefulCount/collectCount）。
- `LitLessonSop`：伴学课↔站内 SOP 多对多。**外键存 `SopPath.id`**（真 FK，级联安全）；对外链接用 `usageId || id` 在序列化层现算（ADR-001，满足 AC-17 且规避 `usageId` 无唯一约束的坑）。

**新增 2 张行为表**：
- `EventLog`：匿名/登录行为事件（name/refType/refId/annonId/userId/props/ua），刻意不加外键、不进事务。
- `EventDaily`：每日聚合（day,name,refType,refId,count,uniques），看板只读此表，raw 保留 30 天。

**对现有模型的唯一侵入式改动**：`SopPath` 增加反向关系 `litLessons LitLessonSop[]`（一行）。`Useful`/`Favorite` 复用现表，扩 `refType="lesson"`（表结构零改动）。`RolePermission.resource` 枚举追加 `literacy`。

### 1.6 公开 API 端点（锁定，沿用裸响应范式，不包 `{code,data}`）

| Method | Path | 用途 |
|--------|------|------|
| GET | `/api/content/literacy/index` | 聚合：模块 + 全量已发布课时摘要（generateStaticParams 共用） |
| GET | `/api/content/literacy/modules` | 模块列表 |
| GET | `/api/content/literacy/modules/[slug]` | 模块详情 + 课时 |
| GET | `/api/content/literacy/lessons` | 课时列表（module/source/stage/link 筛选，硬上限 500） |
| GET | `/api/content/literacy/lessons/[slug]` | 伴学课详情（含关联 SOP、上下篇） |
| POST | `/api/events` | 匿名行为批量上报（恒定 204，白名单校验） |

所有端点只返回 `status==="published"`；错误走 `fail(status,message)`；`safeFetch` 失败返回结构完整 fallback 不抛错。

### 1.7 后台 API 端点（锁定，受 `requireAdmin("literacy", action)` 守护）

`GET/POST /api/admin/literacy/modules` · `GET/PATCH/DELETE /api/admin/literacy/modules/[id]` · `GET/POST /api/admin/literacy/lessons` · `GET/PATCH/DELETE /api/admin/literacy/lessons/[id]` · `PUT /api/admin/literacy/lessons/[id]/sops`（整集合替换）· `POST /api/admin/literacy/lessons/[id]/check-link` · `GET /api/admin/literacy/links` · `POST /api/admin/literacy/link-check`（cron 入口，独立 token）。

### 1.8 页面清单（锁定）

| 页面 | 路由 | 渲染 | 说明 |
|------|------|------|------|
| 索引页 | `/literacy` | ISR 300 | 模块四宫格 + 分诊台 + 配对条（改造现有页） |
| 模块页 | `/literacy/[module]` | ISR 600 + SSG | 复用 `.detail-head` + `.sop-timeline` 骨架 |
| 伴学页 | `/literacy/[module]/[lesson]` | SSG + ISR 3600 | **SEO/AISO 核心资产**，JSON-LD + 回访条 |
| 合规声明 | `/compliance` | 静态 | **新增（AC-43 阻断项）**，内容用 PM 6 条可抄文案 |
| sitemap | `/sitemap.ts` | 内置 | 汇总 literacy + 现有路由 |
| robots | `/robots.ts` | 内置 | Allow + sitemap 指向 |

> **Front 改造文件**：`literacy/page.tsx` 改为从 `content.getLiteracyIndex()` 取数（修现有 SOP 错链 bug）；新增模块页/伴学页/合规页 + `components/literacy/*`；`content.ts` 拆为 `content/` 目录（调用方零改动）；新增 `lib/track.ts`、`app/api/revalidate/route.ts`。
> **Admin 新增**：`app/admin/(protected)/literacy/*`（总览/模块编辑/课时编辑/外链健康）+ `_components/*`；`app/api/admin/literacy/*` + `app/api/events/route.ts` + `app/api/admin/events/rollup`；`prisma/seed-literacy.ts`（独立 upsert，零 deleteMany）。

### 1.9 设计 Token（锁定）

**沿用现有**（全部来自 `globals.css` `@theme inline`）：teal 主色 `--color-primary:#0D9488`、极浅青底 `--color-surface-2:#F5FAF8`、深墨青文字 `--color-text:#134E4A`、Clay 阴影/圆角、`--font-heading` Nunito / `--font-body` DM Sans / `--font-mono` JetBrains Mono。**不引入第二品牌色，不引入紫→粉渐变。**

**新增 6 个（写进 `@theme inline`，组件内不出现裸值）**：`--color-secondary:#2DD4BF`（补现有三处 fallback）、`--color-official-bg/border/fg`（语义别名，全指向中性色）、`--color-link-safe:#0F766E`（链接正文色，5.19:1）、`--color-warn-fg:#92400E`（合规提示文字，6.68:1）。

**P0 已核实的设计系统状态**：全站现有渐变均为 teal→teal（`primary→#2DD4BF`），**不存在 indigo→pink 组合**；唯一一处跨色相渐变是 `.lit-hero h1` 的 `primary→violet`（globals.css:1717），本方案**移除**它，统一为纯色 `color:var(--color-text)`。原型稿 `design/ailiteracy.html` 里的 emoji（🎓📚🛠️🔗）**不进入 Next.js 实现**，全部替换为 `<Icon name="X">`。

### 1.10 埋点事件规范（canonical——调和 PM 与架构师）

> **裁决**：PM 与架构师的事件命名未对齐（PM 用业务语义名、架构师用 `lit_*` 技术名且缺 30s 驻留与退出信号）。以下为**唯一权威枚举**，实现两端必须共用。事件名走白名单，拒绝任意名。

| canonical 事件名 | 触发时机 | refType/refId | props | 对应 PM 原事件 |
|------------------|----------|---------------|-------|----------------|
| `lit_module_view` | 模块页浏览 | module/slug | {} | — |
| `lit_lesson_view` | 伴学页进入（即时） | lesson/slug | {module,source,stage} | — |
| `lit_lesson_view_30s` | **进入后 ≥30s 仍可见**（visibilitychange+计时） | lesson/slug | {module,source,stage} | `lesson_view_30s`（北极星前提） |
| `lit_official_click` | 点"去官方看课"，`sendBeacon` 立即发 | lesson/slug | {linkStatus} | `official_link_click` |
| `lit_sop_click` | 点关联 SOP 跳 `/usages/[id]` | lesson/slug | {sopId,sopTitle} | `related_sop_click` |
| `lit_asset_copy` | 复制导学要点/提示词；**SOP 提示词 assetKey 约定 `sop:{usageId}:prompt`** | lesson/slug | {assetKey} | `sop_prompt_copied` |
| `lit_asset_download` | 下载资产 | lesson/slug | {assetKey} | — |
| `lit_fallback_click` | 外链失效时点了兜底入口 | lesson/slug | {} | `official_link_error`（语义对齐） |
| `lit_module_empty_view` | 模块无课时时浏览 | module/slug | {} | `module_empty_view` |
| `lit_usages_exit` | 从伴学页跳到 `/usages` | lesson/slug | {sopId} | `literacy_to_usages_exit`（P1） |
| `lit_useful_toggle` | 有用表态（与 Useful 写入并行） | lesson/slug | {on} | — |

**北极星指标 `literacy_assisted_WAU-SOP`**（占全站北极星 15%，第 12 周目标 ≥75 人/周）：
> 7 天窗口内，同一 `anonId` **既**发生过 `lit_official_click` 或 `lit_lesson_view_30s`，**又**在本周发生 `lit_asset_copy`（assetKey 以 `sop:` 开头）的去重设备数。
> 实现：后台 analytics 读 `EventDaily`，按上述逻辑做 7 天窗口归因查询（架构 §6.5 需补此查询，原方案仅做了"外链点击率"）。

### 1.11 验收标准（EARS 精选核心 AC）

| 编号 | 功能 | EARS 验收标准 | 优先级 |
|------|------|--------------|--------|
| AC-01 | 模块展示 | While 模块已 published，系统**必须**在 `/literacy` 渲染其卡片（含 icon/标题/导语） | P0 |
| AC-17 | SOP 链接 | If 伴学页有关联 SOP，系统**必须**渲染指向 `/usages/{usageId||id}` 的链接（非工具页） | P0 |
| AC-28/32 | 发布硬校验 | If 课时 `source=official` 且 `officialUrl` 为空或 `guideIntro<400` 字或 `faq<2` 条或关联 SOP<1 条，系统**必须**拒绝 publish（服务端 `fail(422)`），不可降级 | P0 |
| AC-33 | 外链降级 | When `linkStatus=broken`，系统**必须**隐藏主按钮、保留导学正文与 SOP、页面不 404 | P0 |
| AC-39 | 来源声明 | While 伴学页渲染，系统**必须**在 CTA 前常驻来源说明句（课在哪/不代表官方/这页是导学笔记） | P0 |
| AC-43 | 合规页 | While 站点运行，Footer 的"合规声明"**必须**指向真实 `/compliance` 页面（非 `#`） | P0（上线阻断） |
| AC-44 | canonical | When 生成伴学页 metadata，系统**必须**设 `alternates.canonical` 指向本站自身路径（非官方 URL） | P0 |
| AC-47 | 埋点通道 | When 发生 `lit_official_click`，系统**必须**经 `sendBeacon` 即时上报且恒定返回 204 | P0 |
| AC-12 | 空数据 | If 模块下无课时，系统**应该**渲染"课程内容正在整理"态而非崩溃 | P1 |

### 1.12 边界与合规红线（锁定，写进组件注释）

- 只外链、不镜像、不转录、不改写课程正文；本站只写"这节课讲什么"的转述 + 自有点评。
- 来源标识**做句子不做徽章**（防"官方认证"误读）；禁用国徽/党徽/教育部标识/"教育部"字样；不复刻官方 logo/主色/字体；禁用"认证/授权/合作/指定"等词；不 iframe 嵌入官方课。
- 三级下架预案：L1 单条（巡检置 moved + 兜底入口）/ L2 全板块停展（archived，页面不 404）/ L3 彻底清除（301 到模块页）。
- 未成年人数据：不采集姓名/成绩/人脸；隐私说明加一句站内统计告知。
- 性能：ISR revalidate 上限 3600s；构建期 admin 不可达时 `generateStaticParams` try/catch 返回 `[]` + `dynamicParams=true`。

### 1.13 端到端验证步骤（Spec 锁定）

```bash
# 1. 迁移（SQLite 新增 5 表，零 deleteMany）
cd admin && npx prisma db push && npm run db:seed:literacy

# 2. 部署 front（先确认 ecosystem.config.js front 为 exec_mode:"fork"）
cd admin && npx prisma db push   # 仅 SopPath 反向关系，无列变更
# 起 admin + front

# 3. 核心成功流（伴学页）
curl -s "https://eanavi.com/literacy/prompt-basics/three-part-prompt" | grep -q "去国家平台看这节课"   # 伴学页渲染
curl -s "https://eanavi.com/api/content/literacy/lessons/three-part-prompt" | grep -q "/usages/"          # SOP 链接指向 /usages

# 4. 关键错误流（外链失效降级）
# 手动将某课时 linkStatus 置 broken → 断言页面仍 200 且主按钮隐藏、导学正文与 SOP 仍在

# 5. 埋点通道
curl -i -X POST "https://eanavi.com/api/events" -H "Content-Type: application/json" \
  -d '{"anonId":"test","events":[{"name":"lit_official_click","refType":"lesson","refId":"three-part-prompt","props":{}}]}' \
  | head -1   # 断言 HTTP/1.1 204

# 6. 合规页
curl -s -o /dev/null -w "%{http_code}" "https://eanavi.com/compliance"   # 断言 200（非 404/#）
```

### 1.14 变更记录

| 日期 | 变更 | 原因 | 影响 |
|------|------|------|------|
| 2026-08-07 | 首版 Spec | 合并 PM/架构/设计三文档 + Lead 一致性复核 | — |
| 2026-08-07 | 新增 `/compliance` 页到范围 | PM AC-43 阻断项，原两专家文档均未设计该路由 | 新增 1 公开页 + Footer 修复 |
| 2026-08-07 | 事件枚举调和 | PM 与架构师命名未对齐，北极星不可算 | track.ts / rollup 按 §1.10 实现 |

---

## 2. 三方一致性裁决（Lead 复核）

### 2.1 已对齐（✅）
- **SOP 关联**：PM 要求"关联存 Usage.id 修错链"；架构师用 `sopPathId` 真外键 + 序列化层 `usageId||id` 现算（ADR-001），渲染链接同样指向 `/usages/{usageId||id}`，**等价满足 AC-17 且关系完整性更正确**。裁定：采纳架构师方案，PM 的"修错链"意图已达成。
- **来源三态**：PM `original/official/ugc` = 架构师 `LitLesson.source` = 设计稿标记，一致。
- **外链降级**：架构师四级阶梯（L0–L3）= 设计师 `.lit-fallback`/`.lit-back-bar`/版面重排，一致。
- **复用栈 / 0 新增依赖**：三方均确认 Next.js 内建 `revalidatePath`/`sitemap`/`robots` + 浏览器 `sendBeacon`/`AbortSignal.timeout` + 系统 crontab，无新 npm 包。

### 2.2 需调和的差异与裁定（本方案已写入 Spec 闭合）

| # | 差异 | 裁定（写入 Spec） |
|---|------|-------------------|
| **A1** | **`/compliance` 页缺失**：PM AC-43（上线阻断）要求建合规声明页修 Footer 死链，但架构师/设计师均未设计该路由（架构师 §9.9 只修了 sitemap/robots/metadataBase）。 | 新增 `/compliance` 静态页到 §1.8 页面清单；Footer 三处 `#` 死链（合规声明/关于我们/联系我们）改为真实路由或 `mailto`/锚点。内容与 PM 6 条可抄文案一致。 |
| **A2** | **事件命名/语义未对齐**：PM 8 事件含 `lesson_view_30s`（30s 驻留）、`sop_prompt_copied`、`official_link_error`、`literacy_to_usages_exit`；架构师 8 事件为 `lit_*` 但**缺 30s 驻留逻辑与退出信号**，且 `lit_asset_copy` 未区分 SOP 提示词。 | §1.10 定义唯一权威枚举，补齐 `lit_lesson_view_30s`（前端 30s 计时）、`lit_usages_exit`、`lit_module_empty_view`；`lit_asset_copy` 的 assetKey 约定 `sop:{usageId}:prompt` 供归因。后台 analytics 补 WAU-SOP 7 天窗口查询。 |
| **A3** | **兜底链接必填 vs 可选**：设计师要求 `platformHomeUrl` 必填（任何状态都有有效外链目标）；架构师 `LitLesson.fallbackUrl String?` 为可选。 | 裁定：官方课发布时 `fallbackUrl` **必填**（服务端校验，fail 422），或模块/平台级设默认兜底 URL。写进 §1.5 + AC-28 校验项。 |
| **A4** | **source 展示别名**：设计师 `LessonNav` props 用 `'official' | 'site'`，模型为 `official | original | ugc`。 | 裁定：`site` 是 `original` 的 UI 展示别名，`ugc` 为未来态无当前 UI。模型字段名以 `original|ugc` 为准，组件 prop 文档化为别名，避免后期混淆。 |
| **A5** | **`.lit-hero h1` 渐变**：现有 teal→violet 跨色相渐变。 | 移除（globals.css:1717），统一纯色，提升小屏可读性 + 全站一致。非 P0 禁令范围但属正确清理。 |

### 2.3 P0 Harness 门禁结果

| 红线 | 结果 | 证据 |
|------|------|------|
| 禁 emoji 作功能图标 | ✅ 通过 | 全板块图标写成 `<Icon name="X" size={n}/>`；20 个 Phosphor 名已逐一核实存在；原型稿 emoji 不进 Next.js 实现 |
| 禁紫→粉渐变 | ✅ 通过 | 全站仅 teal→teal 渐变；无 indigo→pink；唯一跨色相渐变（teal→violet h1）本方案移除 |
| 禁 AI 模板味 | ✅ 通过 | 无 "Welcome to"/Lorem；示例文案为教师语态；"分诊台"刻意做分隔线列表而非卡片网格；无弹跳缓动（统一 `0.2s ease`） |
| 复用现有栈 | ✅ 通过 | 0 新增 npm 依赖；图标/设计系统/取数缝/部署全部复用 |
| 禁硬编码颜色 | ✅ 通过 | 组件内全 `var(--color-*)`；唯一新裸值 `#92400E`/`#2DD4BF` 定义在 token 层 |

**门禁结论：PASS（带 5 项调和裁定，均已在 Spec §1 + §2.2 闭环，非阻断）。**

### 2.4 设计师裁决项吸收表（verdict: pass，4 blocking + 4 advisory）

设计师结构化裁决为 **pass**，并附 4 项上线前阻断 + 4 项建议。逐项确认均已落入本方案，无遗漏：

| 设计师裁决项 | 类型 | 本方案落点 |
|------|------|------------|
| 落地页 `5模块/18节/24条SOP/6份模板` 为占位，须数据源真实统计、禁硬编码 | blocking | §3 Phase E「统计数字自动统计」；伴学页/模块页不计静态数字 |
| `FeedbackBox` 签名 `{toolSlug,toolName}` 不适配课时上报 | blocking | 列为已知适配项（见 §2.5）：放宽至 `{targetType,targetId,targetName}` 或加 `LessonFeedback` 封装，否则「链接打不开？告诉我们」走不通 |
| `pb-safe` 类未定义致刘海屏安全区失效 | blocking | §3 Phase A「`pb-safe` 补定义」已列入地基修复 |
| `--color-secondary` 未定义靠 fallback 兜 | blocking | §3 Phase A「token 补 6 变量」含 `--color-secondary:#2DD4BF`（§1.9） |
| `.compliance` 对比度 `#F59E0B`→`#92400E` | advisory | §1.9 新增 `--color-warn-fg:#92400E`（6.68:1），顺手修 `/tool/[slug]` 合规提示 |
| 全站补 `rel="noopener noreferrer"`（现 `/tool/[slug]:77` 仅 `noreferrer`） | advisory | 写入 §1.8/伴学页外链规范，外链统一 `noopener noreferrer` |
| 修 `literacy/page.tsx:129` SOP 链接 bug（`/tool/${sop.tool}`→`/usages/${id}`） | advisory | AC-17 + §3 Phase E 已锁定为已知修复 |
| 移动端主 CTA/sticky 禁用 `.btn-sm`（仅 36px） | advisory | §3 Phase A/C 规定 sticky CTA 用 `min-height:44px`，禁用 `btn-sm` |

### 2.5 已知适配项（实现阶段须处理，非设计/需求缺口）

1. **`FeedbackBox` 接口放宽**：`front/src/components/FeedbackBox.tsx` 现签名 `{ toolSlug, toolName }`、底层 `submitFeedback(toolSlug, kind, value)`。伴学页「链接打不开？告诉我们」需上报课时。实现二选一：① props 放宽 `{ targetType:'tool'|'lesson', targetId, targetName }`；② 新增薄封装 `LessonFeedback`。在后端字段扩展前，前端可先用 `kind="纠错"` + 正文前缀 `[死链] {lesson路由}` 兜底，不阻塞上线。
2. **`officialUrl` 真实地址由内容侧提供**：方案中 `basic.smartedu.cn` 为示例主机名，`platformHost` 须由 `new URL(officialUrl).hostname` 解析，不硬编码；`platformHomeUrl`（即 §1.5 `fallbackUrl`）必填，由内容侧核实后写死。

---

## 3. 实施路线（分阶段 + PR 顺序）

> 原则：单 PR 单职责；`content.ts`/`serialize.ts` 拆包必须单 PR 且与功能 PR 分离（同名文件与目录不能共存）。

| 阶段 | 内容 | 关键产出 | 门禁 |
|------|------|----------|------|
| **A. 地基修复** | token 补 6 变量 + 2 处对比度修复 + 移除 h1 渐变 + `/compliance` 页 + Footer 死链修复 + `pb-safe` 补定义 | 全站受益，不阻塞他人 | 对比度实测达标 |
| **B. 数据+取数缝** | `prisma db push`（5 新表）+ `seed-literacy.ts` + 公开 API 5 端点 + `content/` 拆包 + `serialize/` 拆包 | 后台/前端可取数 | `safeFetch` fallback 正常、构建不失败 |
| **C. 伴学页（价值核心）** | `/literacy/[module]/[lesson]` + `components/literacy/*` + JSON-LD + 回访条 + 外链降级 + `track.ts` + `/api/events` | 跑通 1 节课完整链路 | AC-17/33/39/44/47 |
| **D. 模块页** | `/literacy/[module]` 复用 `.detail-head`+`.sop-timeline` | 与伴学页同构，成本低 | 面包屑三级、上下课锁模块 |
| **E. 落地页改造** | `/literacy` 改从 `getLiteracyIndex` 取数 + 配对条 + 分诊台 + 统计数字自动统计 | 修现有 SOP 错链 | 旧页视觉等价、无空窗 |
| **F. 埋点+看板** | `EventLog` 写入 + rollup(cron) + analytics 接管 + WAU-SOP 7天查询 | 北极星可算 | `lit_*` 枚举对齐 §1.10 |
| **G. 部署** | `PRAGMA journal_mode=WAL` + `busy_timeout=5000`；crontab 两条（link-check/rollup）；`ecosystem.config.js` front 显式 `exec_mode:"fork"`；sitemap/robots 上线 | ISR 安全 + 外链自巡检 | 单实例缓存一致 |

**上线不空窗顺序**（架构 §2.4）：先 `db push` + seed（4 模块 published、课时 0）→ 部署新 front（视觉等价旧页）→ 编辑逐条录课时（每录即 revalidate）→ 课时 ≥20 后升级首页为"四宫格+最新流"。

---

## 4. 风险与技术债（Top，按炸裂概率排序）

1. **SQLite 单写者锁**（最高）：埋点高频写 vs 内容编辑写互相阻塞。缓解：`WAL` + `busy_timeout=5000` + 埋点批量写不进事务 + 错峰。迁移 Postgres 触发线：日 PV>1万 / EventLog 日增>5万 / `SQLITE_BUSY`>10次天 / 需多实例。
2. **canonical 配错（一行毁全部）**：指向官方 URL = 全板块判重复内容不索引。处置：写进 review 清单 + 上线 curl 抽查 3 页 `<link rel=canonical>`。
3. **外链依赖不可控**：平台改版/下线。对冲：`source` 留 `original/ugc` 口子，同套结构可承载自研/共创，schema 与路由零改动。
4. **SEO 冷启动**：宁可 40 个够硬页面，不要 200 个凑数。发布门槛（guideIntro≥400 + faq≥2 + SOP≥1）是抗低质聚合的主防线。
5. **content.ts/serialize.ts 拆包**：必须与功能 PR 分离，单 commit 完成删文件+建目录，否则全站 `@/lib/content` 解析失败。
6. **ISR 与部署耦合**：front 改 cluster 多实例会缓存不一致。处置：`ecosystem.config.js` 显式 `exec_mode:"fork"` + 注释。

---

## 5. 底层文档索引

| 文档 | 角色 | 关键内容 |
|------|------|----------|
| `通识课桥接-需求规格.md` | PM | 字段需求、47 条 EARS AC、合规边界+6 条可抄文案、L1/L2/L3 下架预案、埋点指标定义 |
| `AI通识课桥接-技术架构方案.md` | 架构师 | Prisma 模型、迁移、API 契约、渲染策略、后台页、外链健康检查、埋点、8 ADR、风险债 |
| `design/AI通识课桥接板块-UIUX设计方案.md` | 设计师 | 三层 IA、三页线框、来源视觉、5 新增组件、Design Token、降级、响应式、无障碍、P0 自检 |

**本开发方案为上述三文档的合并契约（Spec），任何开发以本方案 §1 + §2.2 裁定为准。**
