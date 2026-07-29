# 教育 AI 工具导航平台 — 搭建方案（实施方案 v1.0）

> 编制视角：市场分析专家 + 技术产品方案
> 日期：2026-07-29 ｜ 目标：面向老师/学生的 AI 工具聚合导航 + 使用路径库
> 假设：中国优先、免费公开目录站起步；MVP 用 Next.js + Supabase 技术栈

---

## 一、项目定位与 MVP 范围

**一句话**：老师/学生"找得到、学得会、用得上"的 AI 工具导航 + 用法手册。

**MVP（8–12 周可上线）范围**
- 收录 **100–200 个**教育相关 AI 工具（老师端为主，学生端为辅）
- 分类维度：**角色 × 场景 × 学科**
- 每工具详情页含**分步使用路径（SOP）+ 可复制模板/提示词**
- 搜索 + 多维筛选；用户提交入口；Newsletter 订阅
- 程序化 SEO 基础页（工具页/场景页/对比页）+ Schema 标记
- **不做**（MVP 阶段）：复杂社区、付费系统、B2B 校方版（留 P2–P4）

---

## 二、信息架构（IA）

### 2.1 分类体系（双轴交叉）
- **角色轴**：老师 / 学生 / 班主任 / 教研组长
- **场景轴**：备课、出题组卷、作业批改、课件制作、家校沟通、班级管理、学情分析、自学答疑、论文/课题
- **学科轴**（可选）：语文/数学/英语/物理…（参考 dh.zjer.cn）
- **能力轴**（互通全量）：写作/图像/视频/语音/编程/智能体

### 2.2 站点地图
```
首页 (/)                  Trending / 按场景入口 / 最新收录 / 投稿
├─ 分类页 (/scene/beike)   场景聚合 + 筛选（角色/学科/价格/平台）
├─ 工具详情页 (/tool/:slug) 定位+优势+局限+使用路径SOP+模板+替代
├─ 对比页 (/compare/a-vs-b) 并排矩阵
├─ 替代页 (/alternatives/:slug)
├─ 搜索 (/search?q=)       Algolia 即时搜索
├─ 投稿 (/submit)          工具提交表单
├─ 用法库 (/playbook)      精选 SOP 合集（内容驱动）
└─ 关于/合规 (/about,/legal)
```

### 2.3 工具详情页字段（数据模型雏形）
```
name, slug, logo, tagline(<100字)
role_tags[], scene_tags[], subject_tags[], capability_tags[]
pricing(Free/Freemium/Paid/Enterprise), platforms[](Web/小程序/API)
summary, pros[], cons[], compliance_note(数据/适龄风险)
usage_paths[]: { title, steps:[{action, prompt_template, output, pitfall}], copyable }
alternatives[], submitted_by, status(draft/review/published), updated_at
```

---

## 三、技术架构

### 3.1 推荐栈（评估综合 9.0/10）
| 层 | 选型 | 理由 |
|---|---|---|
| 前端 | **Next.js (App Router) + TypeScript + Tailwind** | SSG/SSR 对 SEO 友好，RSC 性能好 |
| 数据库/后端 | **Supabase（Postgres + Auth + Storage）** | 一体化，Auth/存储/SQL 齐备，免费起步 |
| 搜索 | **Meilisearch（自托管）** 或 Algolia | Meilisearch 开源低成本；Algolia 体验佳有免费层 |
| 内容后台 | **Airtable/Notion 作为编辑源 → 同步 Supabase**（Whalesync/cron） | 非技术编辑零门槛；或自建 Supabase Admin |
| 部署 | **Vercel**（国内可加 Cloudflare Pages 备选） | Next.js 最优部署，边缘快、SEO 好 |
| 监控 | Vercel Analytics + Sentry | 性能/错误 |

> 极速验证备选：Astro（纯静态极快）或 Webflow + Airtable + Whalesync（一周上线）。

### 3.2 架构图（文字版）
```
[编辑后台 Airtable/Notion] --同步--> [Supabase Postgres]
                                        |
[Next.js 站点 Vercel] <--SSR/SSG-- 读取 --> [Supabase]
        |                                     |
   [Meilisearch 索引] <--增量同步-- 工具表    |
        |                                     |
   [用户浏览器] --提交/评分--> [Supabase Auth + 表]
        |
   [Newsletter: Buttondown/Resend]
```

---

## 四、关键功能模块

1. **工具收录流水线**：提交表单 → 编辑审核（人工策展，保质量）→ 发布 + 自动生成 SEO 页。状态机：`draft → review → published / rejected`。
2. **使用路径 SOP 编辑器**：结构化步骤（动作/提示词模板/产出/避坑），支持"一键复制提示词"。这是核心差异件。
3. **搜索与筛选**：Meilisearch 即时搜索 + 角色/场景/学科/价格/平台多维筛选 + 排序（热门/最新/评分）。
4. **程序化 SEO**：每工具/场景/对比/替代自动生成独立页；注入 JSON-LD（Product / FAQPage / BreadcrumbList / AggregateRating）。
5. **Newsletter**：首页订阅入口，周更"本周新工具 + 一个用法 SOP"，作为增长引擎。
6. **UGC（P2）**：用户投稿、评分、评论、分享自创 SOP。

---

## 五、内容运营 SOP

- **收录标准**：教育相关、可访问、有明确定位；优先国产合规工具（数据不出境）。
- **复核周期**：每月批量复核热度与可用性；AI 工具月月变，死链/过时 30 天内下架。
- **SOP 质量门**：每个上架工具须配 ≥1 条可操作使用路径，编辑审核通过才发布。
- **人工策展优先**：AI 生成描述需人工把关，避免 Google"规模化低质内容"惩罚。

---

## 六、合规清单

- [ ] 教育/未成年场景：工具标注适龄与数据风险，明示"禁止代写"
- [ ] Affiliate 链接明示（合规披露）
- [ ] 用户隐私：订阅/提交走 consent，符合《个人信息保护法》
- [ ] 内容安全：投稿审核，避免违规工具上架
- [ ] 算法/备案：若后续做个性化推荐，评估算法备案要求

---

## 七、实施里程碑

| 周次 | 里程碑 | 交付 |
|---|---|---|
| W1–2 | 需求冻结 + 设计 | IA 定稿、UI 稿、数据模型 |
| W3–5 | 核心开发 | Next.js 骨架、Supabase、工具详情页/列表/搜索 |
| W6–7 | 内容填充 | 收录 100–200 工具 + SOP，编辑后台就绪 |
| W8 | MVP 上线 | Vercel 部署、SEO 基础、Newsletter 开通 |
| W9–12 | 增长打磨 | 程序化页扩量、AISO 优化、投稿/UGC 试点 |

**人力预估**：1 前端/全栈 + 0.5 后端(可选) + 1 内容编辑；或 2 人小队。

---

## 八、成本与人力预估（MVP 月度）

| 项目 | 费用（¥/月，约） |
|---|---|
| 域名 | ¥5 |
| Vercel（Pro） | ¥200 |
| Supabase（Pro） | ¥180 |
| Meilisearch（小服/Algolia 免费层） | ¥0–80 |
| Airtable / Newsletter（免费层） | ¥0 |
| **合计** | **≈ ¥400–470/月** |

> 不含人力。规模上来后按流量升级，但 MVP 阶段成本极低，适合验证 PMF。

---

## 九、风险与应对

| 风险 | 应对 |
|---|---|
| 通用导航巨头流量碾压 | 死守"教育+用法"垂直，不拼全量 |
| 工具更迭快致内容过时 | 月度复核 + 自动死链检测 |
| SEO 低质内容惩罚 | 人工策展 + 独特 SOP 内容 |
| 早期流量不足 | Newsletter + 教师社群分发 + 长尾 SEO 慢热 |

---

### 附：下一步可交付物
- 工具详情页/SOP 模板样例（如"用 AI 出一套初三数学卷"分步路径）
- 信息架构可视化图（可渲染）
- 数据库表结构 SQL / Supabase schema
- MVP 任务拆解看板

> 数据来源：综合前序战略报告及 huasheng.ai AI 目录站技术栈调研（2026-02）、行业通用实践。具体报价以实时询价为准。
