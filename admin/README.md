# 教AI导航 · 后台管理系统（MVP 骨架）

独立后台项目，与 `front/`（公开站）同级。承担「内容中台 + 审核流 + 数据看板」，
通过 `src/lib/serialize.ts` 输出与 `front/src/lib/data.ts` 完全一致的形状，供公开站 `content.ts` 取数缝消费。

## 技术栈

- **Next.js 15（App Router）+ React 19 + TypeScript**
- **Prisma + SQLite**（零外部依赖即可运行；换 Postgres 见下）
- **鉴权**：`jose` 签发 JWT → httpOnly Cookie 会话；`bcryptjs` 密码哈希
- **RBAC**：`AdminUser / Role / RolePermission` 四角色（super_admin / editor / reviewer / school_admin）

## 目录结构

```
admin/
├─ prisma/
│  ├─ schema.prisma        # 合并后的数据模型 + RBAC + 互动表（预留）
│  └─ seed.ts              # 直接 import front 的 data.ts 灌库
├─ src/
│  ├─ middleware.ts        # 保护 /admin 与 /api/admin（仅校验会话，RBAC 在 handler）
│  ├─ lib/
│  │  ├─ db.ts             # Prisma 单例
│  │  ├─ jwt.ts            # edge 安全 sign/verify（middleware 用）
│  │  ├─ auth.ts           # bcrypt + Cookie 会话（Node 运行时）
│  │  ├─ rbac.ts           # userCan(admin, resource, action)
│  │  ├─ serialize.ts      # DB → 前端 Tool/SOP 形状
│  │  └─ http.ts           # ok/fail + requireAdmin 守卫 + CORS
│  └─ app/
│     ├─ layout.tsx page.tsx globals.css
│     ├─ admin/
│     │  ├─ layout.tsx  login/  page.tsx(仪表盘)
│     │  ├─ tools/        # 工具管理：列表 + 编辑
│     │  ├─ sops/         # SOP 编辑器（核心：路径+步骤可视化 + 实时预览）
│     │  ├─ usages/       # 用法库（精选视图）
│     │  ├─ taxonomy/     # 分类法（场景/分类）
│     │  └─ users|feedback|analytics/  # Phase 3 占位
│     └─ api/
│        ├─ auth/         # login / logout
│        ├─ admin/        # tools / sops / taxonomy / stats（RBAC 守卫）
│        ├─ content/      # 公开读（供 front remoteSource）
│        └─ me/           # 用户互动（Phase 3 占位 501）
```

## 运行步骤

```bash
cd admin
cp .env.example .env          # 改 AUTH_SECRET 为强随机串
npm install                   # 含 postinstall: prisma generate
npm run db:init               # prisma db push + 灌种子（import front/data.ts）
npm run dev                   # 监听 3001
```

打开 http://localhost:3001 → 跳登录。
**默认账号**：`admin@ea.test` / `admin123`（种子写入，生产请改密或删种子账号）。

## 前后台对接（让 front 切到后台数据源）

`front` 的 `src/lib/content.ts` 已留 `RemoteSource` 接口。接法：

1. `front` 的 `.env` 设：
   ```
   NEXT_PUBLIC_CONTENT_SOURCE=remote
   NEXT_PUBLIC_API_BASE=http://localhost:3001
   ```
2. 在 `content.ts` 的 `remoteSource` 里用 `fetch(\`${API}/api/content/tools\`)` 调本项目的 `/api/content/*`
   （已带 CORS 头，来源由 `NEXT_PUBLIC_SITE_ORIGIN` 控制）。
3. 后台改工具/SOP → 前台即时生效，无需重建静态。

> 当前 `remoteSource` 尚未在 front 实现（属 Phase 2 收尾），数据库与 API 已就绪。

## 已落地 / 待办

**MVP 已落地**：登录+RBAC、工具 CRUD、SOP 编辑器（含实时预览）、用法库视图、分类法、
仪表盘、公开内容 API、种子脚本（复用 front data.ts）。

**Phase 3 待建**（表已建、API 占位 501）：评分/收藏/笔记/反馈/投稿落库与审核流、
学校管理员推送、数据看板、媒体上传（替换 SOP 步骤的 `mediaUrl` 占位）、对象存储接入。

## 从 SQLite 换 Postgres

1. `schema.prisma`：`provider = "postgresql"`，把 `String` 类型的 JSON 列改为 `Json`、
   需要的枚举列改为 `enum`（可选）。
2. `.env`：`DATABASE_URL="postgresql://user:pass@host:5432/ea?schema=public"`。
3. `npm run db:init` 重新建表灌库。其余代码（serialize/API）无需改动。

## 安全提醒

- `AUTH_SECRET` 生产务必替换；会话 Cookie 为 httpOnly + sameSite=lax。
- RBAC 双重校验：路由级（middleware 验会话）+ 操作级（`requireAdmin` 验权限）。
- 默认管理员密码仅用于本地演示。
