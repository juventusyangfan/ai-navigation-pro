# 教AI导航 · Plan B（全站后台驱动）运行与验证清单

> 适用：本回合已把 front 全部取数改为经 `content` 取数缝（remote 模式），admin 补齐公开路由并修正用法查询语义。  
> 沙箱无法 `npm install` / `prisma generate` / `next build`，以下需在你本机执行验证。

## 一、启动两个服务

### 1. 后台 admin（:3001）

『教AI导航』

### 2. 前端 front（:3000，已带 .env.local 走 remote）

```bash
cd ai-navigation-pro/front
npm run dev            # 监听 http://localhost:3000（front/.env.local 已设 remote + API_BASE=:3001）
```

> 注：front 必须作为**常驻 `next dev` 服务**运行（不是 `output: export` 静态产物），远程 fetch 才能命中。

## 二、后台 API 形状比对（确认远程与静态一致）

浏览器/curl 打开以下地址，与 `front/src/lib/data.ts` 的 `TOOLS/SCENES/USAGES/CATS` 对照：

| 接口                                                      | 期望                                                                 |
| ------------------------------------------------------- | ------------------------------------------------------------------ |
| `http://localhost:3001/api/content/tools`               | 全部工具，含完整 `paths[].steps`                                           |
| `http://localhost:3001/api/content/scenes`              | 全部场景（key/name/icon/roles）                                          |
| `http://localhost:3001/api/content/taxonomy/categories` | `{ key: { icon, phase, desc } }` 形状，与静态 `CATS` 一致                  |
| `http://localhost:3001/api/content/usages`              | **9 条**用法（usageId 非空），且每条 `scene/subj/role/toolName` 与 `USAGES` 一致 |
| `http://localhost:3001/api/content/usages/u2`           | 单条用法，字段保真（如 u2 应为 `scene:zuoye, subj:数学`）                          |

重点核对：用法条数必须是 9（不是 3），且 `scene`/`subj`/`role` 是**用法级**真实值而非工具级推导值。

## 三、前端全站生效验证（:3000）

逐页打开，确认数据来自后台（改 admin 一条数据，front 刷新即变）：

- [ ] 首页 `/`：场景卡、精选、精选用法推荐
- [ ] 场景列表 `/scenes` + 场景详情 `/scenes/[key]`（分类 desc、角色定价筛选）
- [ ] 工具总览 `/tools` + 工具详情 `/tool/[slug]`（SOP、评分、收藏）
- [ ] 用法库 `/usages`（三轴筛选 + 排序）+ 用法详情 `/usages/[id]`
- [ ] AI 通识课 `/literacy`（相关工具卡、SOP 链接）
- [ ] 搜索 `/search?q=`（工具/场景/用法检索）
- [ ] 个人中心 `/profile`（收藏、笔记、评分）

切回静态（如需）：把 `front/.env.local` 的 `NEXT_PUBLIC_CONTENT_SOURCE` 改成非 `remote`（或删该行），重启 front dev 即回退到 `data.ts`。

## 四、已知风险点（本机重点看）

1. **Hydration**：客户端组件在 `useEffect` 内取数，initial render 用空数组/空对象，切回静态只需改 env，不会水土不服。
2. **CORS**：admin `corsHeaders()` 读 `NEXT_PUBLIC_SITE_ORIGIN`（admin `.env` 应含 `http://localhost:3000`），跨域请求需与此一致，否则前端 fetch 被拦。
3. **front next 版本 16 vs admin 15**：两者独立进程，无直接冲突；若 front 启动报配置异常，检查 `next.config` 是否仍为非静态导出。
