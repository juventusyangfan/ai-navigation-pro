# 教育 AI 工具导航平台 — 可扩展系统架构设计 & 长期发展规划

> 角色：软件架构师 ｜ 日期：2026-07-29
> 目标：基于"教育垂类 + 使用路径/SOP"定位，设计一套**从 MVP 单体起步、可平滑演进到平台化**的可扩展架构，并给出 3 阶段长期规划。
> 设计约束：SEO 优先（读多写少）、低成本起步、合规内置、AI/多租户就绪。

---

## 一、架构设计目标与原则

### 1.1 设计目标
- **SEO 优先**：匿名读占 90%+ 流量，首屏与收录体验是生命线（Core Web Vitals、结构化数据）。
- **演进式（Evolutionary）**：MVP 用最小可行架构，随规模与功能按需拆分，避免过早微服务化。
- **可扩展**：流量、工具量、功能模块三维度均可水平扩展。
- **AI / 多租户就绪**：为 Phase 3 的"AI 推荐引擎"与"B2B 校方版"预留扩展点与数据隔离能力。

### 1.2 架构原则
1. **内容/展示分离（Headless 思想）**：内容作为结构化数据，独立于渲染层；编辑后台与站点解耦。
2. **读写分离、读路径极致优化**：写走管理后台/API，读走 SSG/ISR + CDN 边缘缓存。
3. **事件驱动解耦**：工具/内容变更 → 事件 → 异步重建搜索索引与缓存（最终一致）。
4. **无状态展示层**：便于水平扩容与边缘部署。
5. **可观测性 & 合规内置**：日志、指标、审计从第一天起。
6. **扩展点显式化**：分类维度、SOP 模板、工具能力轴均为可配置，而非硬编码。

---

## 二、业务域与边界上下文（Bounded Contexts）

| 域 | 职责 | 关键实体 | 演进阶段 |
|---|---|---|---|
| **Catalog（工具目录）** | 工具/分类/标签的权威数据 | Tool, Category, Tag | P1 |
| **Playbook（使用路径）** | 结构化 SOP、提示词模板 | UsagePath, Step, Template | P1（核心差异） |
| **Search（检索）** | 即时搜索 + 多维筛选 | Index, Query, Facet | P1 |
| **Identity（用户）** | 注册、提交、评分、收藏 | User, Review, Save | P2 |
| **CMS（编辑流水线）** | 收录/审核/发布/下架 | Submission, AuditLog | P1 |
| **Discovery（SEO/Newsletter）** | 程序化页、订阅增长 | Page, Subscriber | P1–P2 |
| **Analytics（分析）** | 流量、转化、热词 | Event, Funnel | P2 |
| **Recommendation（AI 推荐）** | 个性化/语义推荐 | Embedding, RecLog | P3 |
| **Tenant（B2B 多租户）** | 校方内训空间隔离 | Tenant, Workspace | P3 |

---

## 三、分层架构（目标态）

```
┌─────────────────────────────────────────────────────────────┐
│  用户层：匿名访客 / 注册用户 / 编辑 / 管理员 / (P3 校方租户)      │
└───────────────┬─────────────────────────────────────────────┘
                │  HTTPS
┌───────────────▼─────────────────────────────────────────────┐
│  接入层：CDN(Cloudflare/Vercel Edge) + WAF + 限流 + 缓存       │
└───────────────┬─────────────────────────────────────────────┘
                │
┌───────────────▼─────────────────────────────────────────────┐
│  展示层：Next.js(App Router) — SSG / SSR / ISR / RSC           │
│   - 目录页 / 工具详情页 / 场景页 / 对比页 / 搜索页 / 投稿页     │
└───────────────┬─────────────────────────────────────────────┘
                │  BFF / API(Route Handlers)
┌───────────────▼─────────────────────────────────────────────┐
│  领域服务层（初期同进程模块，后期按需独立服务）                 │
│   Catalog │ Playbook │ Search │ Identity │ CMS │ Analytics     │
│   (P3) Recommendation Service │ Tenant Service                │
└───────┬───────────────┬───────────────┬─────────────────────┘
        │               │               │
┌───────▼──────┐ ┌──────▼───────┐ ┌─────▼──────────────────────┐
│  数据层      │ │  检索层       │ │  基础设施（横切）            │
│ Postgres    │ │ Meilisearch  │ │  事件总线/队列(Inngest等)    │
│ Redis(缓存) │ │ (或 Algolia)  │ │  对象存储(Logo/图)           │
│ 对象存储     │ │              │ │  可观测(Sentry/PostHog/Grafana)│
│ (P3)向量库   │ │              │ │  CI/CD · IaC                │
└──────────────┘ └──────────────┘ └─────────────────────────────┘
        横切：安全/合规/内容审核/审计日志（贯穿所有层）
```

---

## 四、技术栈选型（含理由）

| 关注点 | 选型 | 理由 |
|---|---|---|
| 前端框架 | **Next.js (App Router) + TypeScript + Tailwind** | SSG/ISR 对 SEO 极友好；RSC 降低客户端 JS；生态成熟 |
| BFF/API | Next.js Route Handlers（P3 可加 NestJS 独立服务） | 同栈降低复杂度；按需拆分 |
| 主数据库 | **PostgreSQL**（Supabase 或自管） | 关系型 + JSONB 兼顾结构化与灵活字段；Supabase 提供 Auth/Storage 一体化 |
| 搜索 | **Meilisearch**（开源自管）/ Algolia | 毫秒级、Typo 容错、多维筛选；Meilisearch 成本低 |
| 缓存 | **Redis（Upstash）** | 热点数据、会话、限流；边缘可用 |
| 对象存储 | S3 兼容 / Supabase Storage | Logo、截图、模板资源 |
| 事件/队列 | **Inngest / BullMQ / Supabase Edge Functions** | 工具变更 → 异步重建索引/缓存失效 |
| 部署 | **Vercel + Cloudflare**（国内备选边缘） | Next.js 最优；CDN 与 WAF 一体 |
| 可观测 | Sentry + PostHog + Grafana/Loki | 错误、行为、指标、日志 |
| IaC | Terraform（P2+） | 环境可复制 |

> MVP 可全部跑在 **Supabase + Vercel + Meilisearch(小服)**，月度成本 ≈ ¥400–700，验证 PMF 后再加 Redis/队列。

---

## 五、核心数据模型（演进友好）

设计要点：分类维度用**关联表**而非固定列，便于新增"能力轴/学科轴"；SOP 用**结构化子表**支持步骤化渲染与一键复制。

```
Tool
  id, slug(PK 路由), name, logo_url, tagline(<100)
  pricing_enum, platforms[], official_url, affiliate_url
  summary, pros[], cons[], compliance_note
  status(enum: draft/review/published/rejected), created_at, updated_at

ToolTag (M:N)           -- 角色/场景/学科/能力 四类标签统一存，type 字段区分
  tool_id, tag_id, tag_type(role|scene|subject|capability)

Tag
  id, slug, name, tag_type, parent_id(支持层级)

UsagePath (1 Tool : N UsagePath)   -- 核心差异件
  id, tool_id, title, audience, difficulty
  steps: jsonb[{ order, action, prompt_template, output_desc, pitfall }]
  copyable_prompt(text)             -- 一键复制

Review / Save / Submission / AuditLog / Subscriber / (P3)Tenant
```

**SQL 示例（关键表，Postgres）**
```sql
CREATE TABLE tools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  tagline text,
  pricing text CHECK (pricing IN ('Free','Freemium','Paid','Enterprise')),
  platforms text[],
  official_url text,
  affiliate_url text,
  summary text,
  pros text[],
  cons text[],
  compliance_note text,
  status text DEFAULT 'draft',
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX idx_tools_status ON tools(status);
CREATE TABLE usage_paths (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id uuid REFERENCES tools(id) ON DELETE CASCADE,
  title text NOT NULL,
  steps jsonb NOT NULL DEFAULT '[]',
  copyable_prompt text
);
```

---

## 六、关键流程（事件驱动）

**工具收录流水线（写路径）**
```
编辑提交/用户投稿 → CMS 审核(状态机 draft→review→published)
  → 落库 Postgres + 发领域事件 ToolChanged
  → [消费者] 更新 Meilisearch 索引
  → [消费者] 使相关缓存/ISR 页面失效(按需重建)
  → (可选) 触发 AI 向量化(P3)
```

**页面渲染（读路径，极致优化）**
```
请求 → CDN 命中(SSG/ISR 缓存) → 直接返回
未命中 → Next.js 渲染(RSC 取 Postgres + 轻量 Redis 缓存) → 边缘缓存(TTL+stale-while-revalidate)
```

**搜索**
```
用户输入 → Next 搜索 API → Meilisearch(多索引/多维 facet) → 即时结果(JSON)
```

---

## 七、可扩展性设计（重点）

1. **水平扩展**：展示层无状态，多实例 + 边缘节点；DB 走连接池（PgBouncer）+ 读副本。
2. **缓存策略**：CDN(SSG/ISR) + Redis(热点/会话) + stale-while-revalidate；匿名读基本不穿透 DB。
3. **索引异步化**：内容变更经事件总线异步更新搜索索引与缓存，写不阻塞读。
4. **模块化到微服务的拆分信号**（避免过早）：某域 QPS/团队/部署频率显著分化时，再抽独立服务（如 Recommendation、Tenant）。
5. **多租户预留（P3 B2B）**：数据模型加 `tenant_id`；行级策略(RLS)或独立 schema 隔离；CMS 支持"校方私有用法库"。
6. **AI 就绪**：内容（工具描述/SOP/评论）建向量化管道 → 向量库（pgvector / Qdrant）；LLM 编排服务做语义检索与个性化推荐，与搜索层并列。
7. **扩展点配置化**：分类维度、SOP 模板类型、工具能力轴均为数据驱动，新增无需改代码。

---

## 八、安全与合规（内置）

- **PII 最小化**：订阅/提交仅收必要字段，加密存储，明示 consent（《个人信息保护法》）。
- **内容审核**：投稿经审核流 + 敏感词/违规工具拦截；教育场景标注适龄与数据风险，明示"禁止代写"。
- **Affiliate 披露**：联盟链接显著标注。
- **审计日志**：收录/修改/下架留痕，便于复盘与合规。
- **安全基线**：WAF、限流、依赖扫描、CSP、HTTPS 全链路。

---

## 九、长期发展规划（3 阶段）

### Phase 1 — MVP / 验证（0–3 月）
- **架构**：Next.js + Supabase(Postgres+Auth+Storage) + Meilisearch + Vercel（单体模块化）。
- **范围**：100–200 工具、角色×场景×学科分类、每工具 SOP、搜索筛选、投稿入口、Newsletter、程序化 SEO + Schema。
- **关键指标**：收录工具数、索引页收录量、自然搜索流量、Newsletter 订阅、投稿转化率。
- **架构变化**：仅主从读副本（可选），无队列（事件用 Supabase trigger/Edge Function）。

### Phase 2 — 增长 / 社区（3–9 月）
- **架构新增**：Redis 缓存层、Inngest/队列（异步索引/缓存失效）、PostHog 分析、UGC（评分/评论/自创 SOP）、Newsletter 规模化、AISO 优化。
- **范围**：程序化页扩量（对比/替代/长尾）、社区氛围、编辑团队扩编、AI 搜索优化（被豆包/元宝引用）。
- **关键指标**：DAU/MAU、页面停留、UGC 占比、搜索词覆盖、订阅留存。

### Phase 3 — 平台化（9–18 月）
- **架构演进**：
  - 模块化拆分为独立服务（Recommendation、Tenant 优先）；
  - 引入**向量库 + LLM 编排**做语义/个性化推荐（AI 推荐引擎）；
  - **多租户（B2B 校方版）**：租户隔离 + 私有用法库 + 校方内训空间；
  - 开放 API / Partner 接入；数据变现（趋势/榜单）。
- **范围**：AI 推荐、校方 SaaS、开放生态、数据产品。
- **关键指标**：推荐点击率、校方付费租户数、API 调用、ARPU。

---

## 十、演进风险与应对

| 风险 | 应对 |
|---|---|
| 过早微服务化（复杂度爆炸） | 用模块化单体起步，按"拆分信号"再抽服务 |
| 搜索与源数据不一致 | 事件驱动 + 幂等消费者 + 定时全量校准 |
| 流量增长致成本陡升 | 缓存前置、DB 读副本、按阶段升级而非预购 |
| AI 幻觉/合规（P3 推荐） | 推荐仅基于已审核内容 + 人工兜底 + 可解释 |
| 内容过时（工具下架） | CMS 月度复核 + 自动死链检测 + 状态机下架 |

---

## 十一、落地建议（给团队）

- **先按 Phase 1 单体交付**，把"教育 + SOP"差异件做扎实，用 SEO+Newsletter 验证需求。
- **数据模型从第一天按本文设计**，尤其 `ToolTag` 多类型标签与 `UsagePath` 结构化，避免后期大改。
- **事件总线早期就接**（哪怕用 Supabase trigger），为 Phase 2/3 异步化铺路。
- **监控/审计/合规从 MVP 内置**，后期补合规成本极高。
- 架构决策记录（ADR）随关键选型同步沉淀。

---

### 附：架构图（见对话内可视化）与下一步
- 可渲染：C4 容器图 / 时序图（收录流水线 / 渲染读路径）
- 可交付：Supabase 完整 schema SQL、Next.js 路由与 ISR 示例、Meilisearch 索引配置、Phase 1 任务看板
