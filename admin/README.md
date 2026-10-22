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

## 作文测评看板（essays）

侧边栏「服务 → 作文测评」。展示「树蕙伴学」服务号里家长提交的作文评测记录：列表、筛选、
统计、单篇报告，以及按需查看原文。

**数据不在 admin 库里**。作文在 `zuowen/` 这个独立应用（进程 3002、独立 SQLite），
admin 通过它的内部接口读取，两个原因：

1. 正文是 AES-256-GCM 密文，密钥只在 `zuowen/.env` 的 `ZW_TEXT_KEY`。admin 刻意**不持有解密能力** ——
   后台即使被拿下，拿到的也只是密文。
2. 各自一个库，跨库直读会让 schema 变更互相绊住，删表这类操作的影响面也会翻倍。

代价是多一跳本地回环请求（< 5ms）。

### 配置

`admin/.env` 增加三项：

```
ZUOWEN_BASE_URL=http://127.0.0.1:3002       # 同机部署走回环，不出公网
ZUOWEN_CRON_TOKEN=...                        # 必须与 zuowen 的 ZW_CRON_TOKEN 完全一致
ZUOWEN_PUBLIC_BASE=https://zuowen.eanavi.com # 详情页「复制报告链接」用
```

权限（幂等，不动业务数据）：

```bash
npm run db:seed:essays     # editor: essays:read + devices:read/write；reviewer: essays:read + devices:read
```

### 接口

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/admin/essays` | 列表 + 统计，参数 `page/grade/source/level/q/min/max/days` |
| GET | `/api/admin/essays/[id]` | 单篇详情，`?text=1` 才返回解密正文 |
| GET | `/api/admin/essays/export` | 导出 CSV（**只含指标，不含正文**） |

### 这一块刻意不做的事

- **不提供删除**：家长手里的报告链接长期有效，后台删一条等于让某个家庭刚收到的报告变成 404。
- **不导出正文**：导出文件会离开系统（邮件、微信、U 盘），是最容易失控的一环。
- **不默认展示原文**：详情页要先点「显示原文」，避免作文在办公室/投屏场景被无意铺开。

未配置服务时页面不会白屏，会显示「作文测评服务未接通」并给出要补的环境变量。

## 设备额度（devices）

侧边栏「服务 → 设备额度」。这是后台**唯一的写操作**：给某台设备放开/收紧每天的测评次数。

**为什么以「设备」为单位**：zuowen 全程匿名，库里没有家长手机号、微信或孩子姓名，
服务端手上只有 Cookie 里的随机 ID。所以每台设备配一个 **6 位识别码**（去掉 `0/1/O/I/L`），
家长端页脚显示 `本机识别码 ABC-DEF`。

操作流程：家长念出识别码 → 后台按码搜索 → 关掉「限制」= 当天不限次数，或把次数改成指定数字（留空 = 沿用默认 3 次）→ 保存即时生效。
作文详情页左下角也有一个可点的设备码，点进去自动带上搜索条件。

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/admin/devices` | 列表，参数 `page/q`。首次进入带 `sync=1`，给历史设备补识别码 |
| PATCH | `/api/admin/devices/[code]` | 改额度，body `{ limitEnabled, customLimit, note }` |

权限：`devices:read`（editor + reviewer）、`devices:write`（**仅 editor**）。
不给 reviewer 写权限 —— 它直接控制成本与「谁能免限额」，和审核职责无关，出错代价不对等。

```bash
npm run db:seed:essays   # 同一条命令顺带授予 devices 权限（幂等）
```

**三个边界**：

- 家长换手机、换浏览器、清缓存 → 识别码会变，需要重新开一次。
- 放开个人次数**不会绕过** zuowen 的全站每日上限（默认 300 条），那道是防刷爆账单的硬顶。
- 备注只写内部标签（「张妈妈·四年级」），**不填手机号、微信号、孩子姓名**。

每次改动都会在服务端日志留痕：`[admin][devices] 操作人 → 设备码 limitEnabled/customLimit`。

## 安全提醒

- `AUTH_SECRET` 生产务必替换；会话 Cookie 为 httpOnly + sameSite=lax。
- RBAC 双重校验：路由级（middleware 验会话）+ 操作级（`requireAdmin` 验权限）。
- 默认管理员密码仅用于本地演示。
