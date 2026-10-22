# 树蕙伴学 · 小学写作水平测评

服务号「写作水平测评」菜单的落地页。家长上传或粘贴孩子作文，拿到一份可执行的点评：
四维分数、写得好的地方、两三处具体改法。

独立进程（3002）、独立数据库，与 admin / front 完全隔离 —— 这个应用挂了不影响主站。

---

## 一、本地跑起来

```bash
cd zuowen
npm install

# 1. 配环境变量
cp .env.example .env
# 填两个必填项：
#   ZW_LLM_API_KEY   模型 Key（OpenAI 兼容，需支持图片输入）
#   ZW_TEXT_KEY      32 字节密钥，生成：
#                    node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 2. 建库
npx prisma db push

# 3. 起服务
npm run dev        # http://localhost:3002
```

先访问 `http://localhost:3002/api/health`，三项都是 true 才算配好：

```json
{ "ok": true, "db": "ok", "llm": { "configured": true, "model": "deepseek-flash" }, "textKey": true }
```

生产：

```bash
npm run build && npm run start
```

---

## 二、部署到服务器

```bash
# 1. 拉代码
cd /srv/app/ai-navigation-pro && git pull

# 2. 装依赖（会顺带 prisma generate）
cd zuowen && npm install

# 3. 写 .env（复制 .env.example，填真实的 Key 与 ZW_TEXT_KEY）
vi .env

# 4. 建表
npx prisma db push

# 5. 构建并启动
npm run build
pm2 start ../ecosystem.config.js --only zuowen
# 已在 pm2 里的更新：
# pm2 reload zuowen --update-env
```

nginx：把 `deploy/nginx-zuowen.conf` 放到 `/etc/nginx/conf.d/`，改好证书路径后：

```bash
sudo certbot --nginx -d zuowen.eanavi.com     # 首次签证书
sudo nginx -t && sudo systemctl reload nginx
```

> **两个必看的坑，配置里已经写好注释**
> `client_max_body_size 12m` —— 作文照片是 data URL 提交的，不改会 413，前端只显示「提交失败」。
> `proxy_read_timeout 120s` —— 两次模型调用最坏 90 秒，nginx 先断开会表现成「网络不稳定」，而服务端还在算、钱也照花。

**服务号菜单**：在「自定义菜单」里把这个菜单项的跳转地址设为 `https://zuowen.eanavi.com/`。
注意安全域名要在「设置与开发 → 公众号设置 → 功能设置」里加上 `zuowen.eanavi.com`，
根目录校验文件放 `zuowen/public/`（与 radar 那份同样的做法）。

**给后台看板开口子**（admin 侧，一次性）：

```bash
# 1. admin 的 .env 加两项（ZUOWEN_CRON_TOKEN 必须等于本应用的 ZW_CRON_TOKEN）
#    ZUOWEN_BASE_URL=http://127.0.0.1:3002
#    ZUOWEN_CRON_TOKEN=<同 ZW_CRON_TOKEN>
#    ZUOWEN_PUBLIC_BASE=https://zuowen.eanavi.com

# 2. 给 editor / reviewer 授 essays:read（幂等，不动业务数据）
cd ../admin && npm run db:seed:essays

# 3. 重建后台并带上新环境变量
npm run build && pm2 reload admin --update-env
```

后台位置：`admin.eanavi.com` → 服务 → 作文测评。**只读**：不提供删除与正文导出，
正文默认不加载，需要核对时点「显示原文」。

---

## 三、环境变量

| 变量 | 必填 | 说明 |
|---|---|---|
| `DATABASE_URL` | ✅ | SQLite 路径，`file:./dev.db`（相对 prisma 目录） |
| `ZW_LLM_API_KEY` | ✅ | 模型 Key。缺失时接口返回 503，不会静默降级成假报告 |
| `ZW_LLM_BASE_URL` | | 默认 `https://api.deepseek.com`，换供应商只改这行 |
| `ZW_LLM_MODEL` | | 默认 `deepseek-flash`（V4.1 Flash，原生支持图片） |
| `ZW_LLM_DISABLE_THINKING` | | 默认 `1`（关闭思考）。换不支持该参数的网关时设 `0` |
| `ZW_TEXT_KEY` | ✅ | 作文正文加密密钥（32 字节）。**换掉后旧记录正文不可解密**，报告仍可看 |
| `ZW_IP_SALT` | | IP 哈希盐，建议改掉默认值 |
| `ZW_DAILY_LIMIT` | | 单设备每日次数，默认 3。**可被后台按设备覆盖**（见第五节） |
| `ZW_GLOBAL_DAILY_CAP` | | 全站每日总次数，默认 300（防批量换 Cookie 刷）。后台放开个人次数也不会绕过它 |
| `ZW_CRON_TOKEN` | | 内部接口凭证。**不配就是关闭状态**（一律 401） |
| `NEXT_PUBLIC_MP_QR` | | 服务号二维码路径，如 `/qr/mp.png` |
| `NEXT_PUBLIC_WORK_QR` | | 企微二维码路径，如 `/qr/work.png` |

---

## 四、二维码怎么换

两张图已经放好（`public/qr/mp.png` 服务号、`public/qr/work.png` 企微，均为 520 见方 PNG），
出现在两个位置：**首页表单下方**的「关注树蕙伴学」卡片、**报告页底部**的橙色引流块。

换图只需覆盖同名文件，改完 `npm run build && pm2 reload zuowen`。路径由 `.env` 的
`NEXT_PUBLIC_MP_QR` / `NEXT_PUBLIC_WORK_QR` 控制，改路径也要重新 build（值在构建期注入）。

**没放图不会破图** —— 服务端会先检查文件是否存在，不存在就渲染成虚线占位框。
（不要靠 `<img onError>` 兜底：图片 404 常发生在 React 绑定事件之前，那个 error 会被丢掉。）

---

## 五、接口

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/evaluate` | 提交作文，返回报告 |
| GET | `/r/[id]` | 报告页（凭 id 直接访问，id 为 cuid 不可枚举） |
| GET | `/api/health` | 健康检查，只报配置是否就位 |
| GET | `/api/device` | 家长端：签发匿名身份并返回**本机识别码**与今日剩余次数 |
| GET | `/api/internal/reviews` | 内部列表，需 `x-cron-token` 头 |
| GET | `/api/internal/reviews/[id]` | 内部单篇详情，需 `x-cron-token` 头 |
| GET | `/api/internal/devices` | 设备额度列表，需 `x-cron-token` 头 |
| PATCH | `/api/internal/devices/[code]` | 改某台设备的每日额度，需 `x-cron-token` 头 |

`/api/internal/reviews` 的参数（全部可选，2026-10 为 admin 后台扩展）：

| 参数 | 说明 |
|---|---|
| `page` / `pageSize` | 分页，默认 1 / 20，`pageSize` 上限 100 |
| `limit` | 旧参数，等价于 `pageSize`（上限 200）。**只传 `limit` 时默认带正文**，保持旧用法不变 |
| `grade` | 1—6 |
| `source` | `text` / `image` |
| `level` | 优秀 / 良好 / 合格 / 待提升 |
| `q` | 标题关键词（正文是密文，无法全文检索） |
| `min` / `max` | 总分区间 |
| `days` | 最近 N 天，按**北京时间**切日（`days=1` 即今天） |
| `withText` | `1` 带解密正文，默认 `0` |
| `stats` | `1` 附带统计聚合（总数 / 今日 / 近 7 天 / 均分 / 年级、等级、来源分布） |

返回 `{ ok, count, total, page, pageSize, totalPages, items, stats? }`，其中 `count` 为本次条数（兼容旧字段）。

查看最近 50 条（旧用法，带正文）：

```bash
curl -H "x-cron-token: $ZW_CRON_TOKEN" "https://zuowen.eanavi.com/api/internal/reviews?limit=50"
```

分页 + 统计（admin 后台用的形态，不带正文）：

```bash
curl -H "x-cron-token: $ZW_CRON_TOKEN" \
  "https://zuowen.eanavi.com/api/internal/reviews?page=1&pageSize=20&stats=1&grade=4&days=7"
```

单篇详情（`text=0` 只取报告不取正文）：

```bash
curl -H "x-cron-token: $ZW_CRON_TOKEN" \
  "https://zuowen.eanavi.com/api/internal/reviews/<id>?text=0"
```

返回里含解密后的正文，属于敏感数据，只在服务端之间调用，别在浏览器里打开。

### 设备识别码与人工开额度

家长加了企微，要给他多测几次。但服务端只知道 Cookie 里的匿名 ID，没有家长身份。
所以每台设备配一个 **6 位识别码**（去掉 `0/1/O/I/L` 等电话里最容易听错的字符）：

- 家长打开测评页，页脚显示 `本机识别码 ABC-DEF`；
- 家长念给老师 → 老师在后台（admin → 服务 → 设备额度）按码搜到 → 改额度；
- 识别码只是「给人看的标签」，权限绑在 `anonId` 上，前端拿不到 code→anonId 的映射。

三档额度（存 `Device` 表）：

| 状态 | 字段 | 效果 |
|---|---|---|
| 默认 | `limitEnabled=true, customLimit=null` | 按 `ZW_DAILY_LIMIT`（3 次） |
| 自定义 | `limitEnabled=true, customLimit=N` | 每天 N 次（1—200） |
| 不限 | `limitEnabled=false` | 不限制个人次数，**仍受全站上限** |

```bash
# 列设备（sync=1 先给历史设备补识别码）
curl -H "x-cron-token: $ZW_CRON_TOKEN" \
  "https://zuowen.eanavi.com/api/internal/devices?page=1&sync=1"

# 放开到每天 20 次
curl -X PATCH -H "x-cron-token: $ZW_CRON_TOKEN" -H "Content-Type: application/json" \
  -d '{"limitEnabled":true,"customLimit":20,"note":"张妈妈·四年级"}' \
  "https://zuowen.eanavi.com/api/internal/devices/ABC-DEF"

# 完全不限
curl -X PATCH -H "x-cron-token: $ZW_CRON_TOKEN" -H "Content-Type: application/json" \
  -d '{"limitEnabled":false}' "https://zuowen.eanavi.com/api/internal/devices/ABC-DEF"

# 恢复默认
curl -X PATCH -H "x-cron-token: $ZW_CRON_TOKEN" -H "Content-Type: application/json" \
  -d '{"limitEnabled":true,"customLimit":null}' "https://zuowen.eanavi.com/api/internal/devices/ABC-DEF"
```

**两个必须知道的边界**：

1. 家长换手机、换浏览器或清缓存 → `anonId` 变了，识别码也变，需要重新开一次。
   匿名方案绕不开这一点；换来的是库里没有任何可识别家长身份的信息。
2. `note` 只写内部看得懂的标签（「张妈妈·四年级」），**不要填手机号、微信号、孩子姓名**。
   一旦存了，这个库就从「匿名测评」变成「儿童与家长身份关联库」，隐私条款要整体重写。

历史设备（`Device` 表上线前就提交过的）没有识别码，后台设备页首次打开会自动补齐，
也可以手动带 `?sync=1`。这是唯一会在 GET 里写库的地方，所以做成显式参数触发。

提交示例：

```json
{
  "grade": 3,
  "title": "我的妈妈",
  "text": "作文正文……",
  "images": ["data:image/jpeg;base64,..."],
  "consent": true
}
```

`text` 与 `images` 二选一（同时给时以 `text` 为准），图片最多 3 张。

---

## 六、几个设计决定（改之前先看）

**为什么图片要先单独识别一次、再评一次**
一次调用同时「识图 + 评测」时，模型会自己估算篇幅，把 98 字说成「一百五十字左右」。
字数一错，整份报告在家长眼里就不可信。所以正文必须先落成文字、字数由服务端自己数。

**为什么总分不用模型给的值**
模型给的总分经常和四个分项对不上。一律以分项之和为准，等级也由总分推导，
避免出现「总分 85、分项加起来 78」这种自相矛盾。

**为什么原文引用要做存在性校验**
亮点里的 `quote` 必须能在正文里逐字找到，找不到就丢弃这条。
宁可少写一条，也不让报告里出现孩子没写过的话。

**为什么评价字段要过合规过滤**
「提分 / 排名 / 最权威 / 包过 / 升学加分」这类词命中就整句换成中性表述，并记进日志的 `flags`。
作文正文里出现「最」不算问题（「我最喜欢的玩具」是正常写法），所以只扫模型生成的话。

**为什么原图不落盘**
图片只在内存里解码、送模型、随即丢弃，落盘的只有识别出的正文，且正文是 AES-256-GCM 密文。
孩子的手写原件不值得长期留存，删了也就没有泄露面。

**为什么关闭了模型的「思考」**
实测四篇不同水平的作文对比：开着思考时 reasoning 要吃掉 60% 的输出 token，
单次耗时 2—10 秒；关掉之后评分排名完全一致、区分度反而更大（58/62/72/88 对 58/65/73/83），
输出也更短。家长等 10 秒就是流失率，所以默认关闭。

---

## 七、合规红线（不要改）

- 首屏必须过《儿童个人信息处理规则》同意，`consent` 不为 true 接口直接 400。
- 不收集姓名、学校、班级；年级只用于选评分基准。
- 报告页页脚固定声明「非考试评分、不作任何承诺」，不要删。
- 评价字段不得出现提分、排名、与他人比较、绝对化表述、升学关联。
- 不代报名、不承诺获奖、不与评优挂钩。

---

## 八、目录

```
zuowen/
├── prisma/schema.prisma        数据模型（含加密字段说明）
├── src/app/
│   ├── page.tsx                首页表单
│   ├── r/[id]/page.tsx         报告页（服务端渲染）
│   └── api/
│       ├── evaluate/route.ts   核心：限额 → 取正文 → 评测 → 归一化 → 加密入库
│       ├── device/route.ts     家长端：签发匿名身份 + 返回本机识别码
│       ├── health/route.ts
│       └── internal/           内部接口（token）：reviews 列表/详情 + devices 列表/改额度
├── src/lib/
│   ├── rubric.ts               评分规则：prompt、归一化、合规过滤 ← 改评分先看这个
│   ├── grade.ts                六个年级的字数区间与评分侧重
│   ├── llm.ts                  OpenAI 兼容多模态调用（超时/重试/错误分类）
│   ├── crypto.ts               正文字段加密
│   ├── quota.ts                匿名 ID、Cookie 下发、每日限额与全站熔断
│   ├── device.ts               设备识别码（6 位可读码）与三档额度计算 ← 改额度先看这个
│   ├── internal.ts             内部接口鉴权（恒定时间比对）+ 北京时间切日
│   └── http.ts                 统一 JSON 出口
├── src/components/QrCard.tsx   二维码（不存在时优雅降级）
├── deploy/nginx-zuowen.conf
└── public/qr/                  放二维码图
```
