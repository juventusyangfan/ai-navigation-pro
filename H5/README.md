# H5 听说测评（最小可用版）

移动端 H5 英语听说测评的最小开发框架：**测评页 + 结果分析页**，无登录、无支付、无后台、无后端服务。

技术栈：Vue 3 + Vite，生产依赖仅 `vue` 一个；路由用手写 hash 路由（静态托管零 rewrite 配置）。

---

## 一、启动命令

```bash
cd ai-navigation-pro/H5

npm install      # 安装依赖（约 20 个包，10 秒内）
npm run dev      # 本地开发，默认 http://localhost:5173
npm run build    # 构建静态资源到 dist/
npm run preview  # 预览构建产物，http://localhost:4173
```

> Node 版本要求：18.18+ / 20+（本项目在 Node 22 下验证通过）。

**访问地址**

| 环境 | 地址 |
|---|---|
| 本地开发 | http://localhost:5173 |
| 本地预览构建产物 | http://localhost:4173 |
| 手机同局域网真机调试 | http://<电脑内网IP>:5173 （`npm run dev` 已开 `--host`） |
| 生产（腾讯云） | https://h5.eanavi.com |

> ⚠️ **录音必须在安全上下文下才能用**：只有 `https://` 或 `localhost` 能调用麦克风。真机调试请用内网 IP 时，Chrome 会禁用麦克风 —— 真机测录音请走下面第三节的 HTTPS 域名，或用 Chrome 的 `chrome://flags/#unsafely-treat-insecure-origin-as-secure` 临时放行。

---

## 二、页面与路由

| 路由 | 页面 | 能力 |
|---|---|---|
| `#/`（默认） | `src/pages/Assessment.vue` 测评页 | 听力播放（TTS/音频）、口语录音（音量条+计时+回放）、选择题作答、逐题提交，产出结构化作答数据 |
| `#/result` | `src/pages/Result.vue` 结果分析页 | 总分、五大维度得分条、逐题明细与录音回放、规则化改进建议 |
| `#/readaloud` | `src/pages/ReadAloud.vue` 模仿朗读真评 | **腾讯云智聆口语评测（新版）真实评分**闭环，见第七节 |

体验卷结构（`src/data/paper.js`，满分 30 分，与中考听说框架对齐）：

1. 听后选择 10 分（2 题）
2. 模仿朗读 5 分（1 篇）
3. 情景交际 5 分（1 题口头作答）
4. 信息转述 10 分（1 题）

---

## 三、部署到腾讯云（沿用现有轻量服务器 + Nginx 子域名方案）

现有服务器已部署 `front(:3000)` / `admin(:3001)`，本项目是**纯静态站点**，不需要 Node 进程、不需要 PM2，只用 Nginx 托管 `dist` 目录。

### 3.1 首次部署

```bash
# 1) 域名解析：新增 A 记录
#    h5  ->  <服务器公网IP>

# 2) 服务器上构建（或本地 build 后上传 dist）
cd /srv/app/ai-navigation-pro/H5
npm install && npm run build

# 3) 配置 Nginx
sudo cp deploy/nginx-h5.conf /etc/nginx/sites-available/eanavi-h5
sudo ln -sf /etc/nginx/sites-available/eanavi-h5 /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# 4) 申请 SSL（证书申请期间需临时注释配置里的 return 301）
sudo certbot --nginx -d h5.eanavi.com --non-interactive --agree-tos -m your-email@example.com --redirect

# 5) 验证
curl -I https://h5.eanavi.com    # 期望 200
```

### 3.2 后续更新

```bash
cd /srv/app/ai-navigation-pro/H5 && bash deploy/deploy.sh
```

（脚本执行：git pull → npm install → npm run build → nginx reload）

### 3.3 接入微信服务号的注意项

- **必须 HTTPS**：`https://h5.eanavi.com`，否则麦克风不可用、微信内也会被拦截。
- **域名已备案**：服务号菜单/图文跳转的域名必须完成 ICP 备案，且需在该域名下放置微信校验文件（如需）。
- **JS 接口安全域名**：若后续要调 JS-SDK（分享、录音等），需在公众号后台「功能设置 → JS接口安全域名」配置 `h5.eanavi.com`。
- **微信内置浏览器录音**：iOS/Android 微信容器对 `getUserMedia` 支持不稳定，页面内已做降级提示（引导「右上角 ··· 用浏览器打开」）。这是本项目最大的体验风险点，建议首批真机验证覆盖 iPhone 与主流安卓机型的微信 + 系统浏览器双环境。
- 结果页已内置「本结果为练习反馈，不代表考试得分」免责声明，符合对外口径红线。

---

## 四、目录结构

```
H5/
├── index.html                # 移动端入口（viewport-fit / 禁缩放）
├── package.json              # 依赖：vue + vite + @vitejs/plugin-vue
├── vite.config.js            # base './'（相对路径，便于任意目录托管）
├── .nvmrc                    # 固定 Node 22，配合 nvm use 使用
├── README.md
├── scripts/
│   └── check-node.mjs        # Node 版本预检（ASCII 输出，低版本也能运行）
├── server/
│   ├── index.mjs             # 密钥服务（只下发密钥，不转发音频）
│   └── .env.example          # SOE_APPID / SecretId / SecretKey 配置样例
├── public/vendor/
│   └── TencentSOE-1.0.1.js   # 腾讯云官方 SOE Web SDK（v1.0.1，需 type="module" 加载）
├── deploy/
│   ├── nginx-h5.conf         # Nginx 站点配置（h5.eanavi.com，含缓存与安全头）
│   └── deploy.sh             # 服务器一键更新脚本
├── dist/                     # 构建产物（部署目录，已 gitignore）
└── src/
    ├── main.js               # 应用入口
    ├── App.vue               # 外壳：头部 + 安全上下文告警 + 路由出口
    ├── router.js             # 极简 hash 路由（无 vue-router 依赖）
    ├── styles/main.css       # 移动端样式（CSS 变量，无 UI 框架）
    ├── data/paper.js         # 体验卷数据（题面、听力文本、要点、建议时长）
    ├── data/readAloudPaper.js # 模仿朗读短文素材（段落模式 ≤120 词）
    ├── services/
│   ├── audioPlayer.js    # 听力播放：有 audioUrl 用音频，无则用浏览器 TTS
│   ├── recorder.js       # 录音：getUserMedia + MediaRecorder + 音量条 + 麦克风释放
│   ├── player.js         # 录音回放：原生播放 + duration 修复 + WebAudio 降级
    │   ├── evaluator.js      # 评分：选择题判分 + 口语模拟评分 + 报告汇总 + 建议
    │   ├── store.js          # 结果存储（localStorage）与音频 URL 内存缓存
    │   └── soeSdk.js         # 智聆 Web SDK 封装：加载 SDK、取密钥、发起评测、解析结果
    └── pages/
        ├── Assessment.vue    # 测评页
        └── Result.vue        # 结果分析页
```

---

## 五、评分是「模拟」的，替换点在哪

当前 `src/services/evaluator.js` 里的 `evaluateSpeech()` 是**本地模拟评分**：不上传音频、不调用外部接口，只用「录音时长 / 建议时长」的比值生成准确度、流利度、完整度、要点覆盖四维分数，目的是先把「采集 → 评分 → 报告」整条链路跑通。

接入**腾讯云智聆口语评测（新版）**时只需两步，报告层代码不用改：

1. 后端新增 `/api/eval`：服务端签发 WSS 签名（`Base64(HmacSHA1(签名原文, SecretKey))`），转发音频到 `wss://soe.cloud.tencent.com/soe/api/<appid>`，**SecretKey 绝不下发到前端**；
2. 把 `evaluateSpeech()` 换成已写好的 `evaluateByServer()`（读取 `VITE_API_BASE`），返回结构保持 `{ accuracy, fluency, completion, content, words: [] }` 即可。

> 智聆新版硬约束备忘：音频 16kHz/16bit/单声道，pcm/wav/mp3(≥32kbps)/speex；单次最长 300s；默认单账号并发 50 路（超出 30 元/路/月）；发送节奏 1:1 实时率。

---

## 六、已知限制（MVP 范围内）

- 听力音频用浏览器 TTS 合成，音色与真实考试录音不同；把真人录音 mp3 放进 `public/audio/` 并在 `paper.js` 填 `audioUrl` 即可切换。
- 录音保留在当前会话内存（blob + blob URL），刷新页面后回放失效；结果结构化数据存 localStorage。
- 试听不用原生 `<audio controls>`：MediaRecorder 产出的容器缺 duration（原生拿到的 `duration` 是 `Infinity`），会导致进度条失效、iOS Safari 点了不响。`services/player.js` 先修 duration，修不好就降级到 WebAudio `decodeAudioData` 播放（UI 会标注「兼容模式」）。
- 模拟评分不具信效度，仅供链路演示与交互验证，禁止对外当作真实成绩使用。
- 未实现：登录、支付、后台管理、题库管理、班级/作业、音频上传服务端留存。

---

## 七、模仿朗读 · 智聆真评闭环（`#/readaloud`）

用**腾讯云官方 Web SDK** 跑通单题型真评：录音 → 智聆 → 三维分 → 词级明细。

### 7.1 技术选型（已核实）

官方新版 SDK 只有 Android / iOS 客户端与 Python / Java / Go 服务端，**Web 端唯一官方 SDK 是这个 JS SDK**：
`https://github.com/TencentCloud/tencentcloud-speech-sdk-js`（`soe` 目录，v1.0.1，包名 `soenew-sdk-js`，未发 npm，故已把 dist 存到 `public/vendor/TencentSOE-1.0.1.js`）。

- SDK 内部已封装：麦克风采集 → 重采样 16k/16bit/单声道 PCM → 分片节奏 → **HMAC-SHA1 签名** → WSS 收发。所以我们不自己撸 WebSocket。
- 主类 `SowNewSocketSdk`（内置录音）；`SoeNewConnect`（自带音频，`write(data)`）。回调用 `OnEvaluationStart / OnEvaluationResultChange / OnEvaluationComplete / OnError / OnRecorderStop`。
- ⚠️ **坑（已修）**：官方 dist 末尾带 `export{w as default}`，是 webpack module 产物，用经典 `<script>` 加载必报 `Unexpected token 'export'`，必须 `type="module"` 加载（模块体内仍会挂 `window.SowNewSocketSdk`）。

### 7.2 链路

```
H5 ──HTTP──> 自建 server(/api/soe/credential)   拿密钥
H5 ──WSS───> soe.cloud.tencent.com             官方 SDK 直连，音频不出腾讯云
```

后端**不转发音频**：只下发密钥，省一跳、少一份合规责任。

### 7.3 跑起来

```bash
# 1) 配置密钥
cp server/.env.example server/.env   # 填 SOE_APPID / SOE_SECRET_ID / SOE_SECRET_KEY
# 控制台：https://console.cloud.tencent.com/cam/capi（AppId 在「账号信息」页，非微信 AppId）

# 2) 起服务（两个终端）
npm run server     # 密钥服务 127.0.0.1:8787
npm run dev        # H5  http://localhost:5173/#/readaloud
```

未配置密钥时页面会明确提示，并可点「用模拟数据预览报告」验证 UI。

**AppId 在哪看**：登录腾讯云控制台 → 右上角**头像** → **账号信息** → **基本信息** → 就是「APPID」那一栏（与账号 ID/UIN 唯一对应）。直达：https://console.cloud.tencent.com/developer

不想手动查的话，也可以用密钥调 CAM 换：`Action=GetUserAppId`（`cam.tencentcloudapi.com`，TC3 签名），返回的 `AppId` 字段即是。

#### 常见服务端报错（`soeSdk.js` 已内置友好映射，页面会显示处理建议 + 原文）

| 原文 | 含义 / 处理 |
|---|---|
| 账号未开通本服务，请在控制台开通服务 | **账号未开通智聆口语评测**。到 https://console.cloud.tencent.com/soe 开通（注意英文版），开通后重试 |
| 欠费 / 余额不足 | 免费额度用尽或欠费，充值或买资源包 |
| 签名 / 鉴权失败 | 核对 SecretId / SecretKey / AppId 三者同账号；AppId 是腾讯云账号 APPID，不是微信 AppId |
| 并发超限 | 默认 50 路并发，超额需买并发包 |
| 未检测到有效语音 | 检查麦克风授权与环境噪音 |

### 7.4 安全红线（默认已经挡住）

| 配置 | 行为 |
|---|---|
| 默认（`SOE_ALLOW_STATIC=0`） | `/api/soe/credential` 返回 501，**拒绝下发永久密钥** |
| `SOE_ALLOW_STATIC=1` | 仅本地调试，把永久密钥发给浏览器（启动时会打警告） |
| `SOE_STS_ROLE_ARN=...` | 生产路径：走 CAM `GetFederationToken` 换临时密钥（需另装 `tencentcloud-sdk-nodejs-sts`，`server/index.mjs` 里已留实现位） |

正式上线**必须**用临时密钥；永久密钥下发到浏览器等于把账号交出去。

### 7.5 已验证 / 未验证

已验证（本机 Chromium 实测）：SDK 加载成功（`SowNewSocketSdk`/`SoeNewConnect` 均为 function）、密钥服务与 Vite 代理联通、未配置密钥的降级引导、报告 UI 渲染、AppId 由 CAM `GetUserAppId` 取回（1315596766）。

**真实调用已跑通（2026-09-18，AppId 1315596766）**：WSS 握手成功、服务端返回 `code:0` 且 `final:1`，完整链路闭环。过程中修掉两个真实问题：

1. **页面永远卡在「评测中」**：`stop()` 只 `await c.done` 却**没调 `c.stop()`**，SDK 不发 `{"type":"end"}`，服务端等不到结束信号就永不返回最终结果。已修（`ReadAloud.vue` 的 `stop()` 先调 `c.stop()` 再 await）。排查手法：Playwright 监听 `page.on('websocket')` 的 framesent/framereceived，能直接看到"音频帧一直发、服务端只回了 initial 那条"。
2. **无效语音会显示莫名的 0 分**：无有效人声时服务端回 `SuggestedScore=0 / PronAccuracy=0 / PronCompletion=0 / PronFluency=-1 / Words=[]`。`normalizeResult` 已加 `noSpeech` 判定，页面改提示"未检测到有效语音，本次不计分"。

**一个被推翻的假设**：`result` 字段**不是** Go 结构体风格字符串，新版 SDK 回传的已是**解析好的 JSON 对象**（`soeSdk.js` 保留字符串分支仅作兜底）。

**仍需真人录音验证**：本机 Chromium 假麦克风发的是蜂鸣声（非人声），所以拿不到有效分数，`Words` 数组解析与五分制定标还没被真实数据校验过。请在浏览器里真实朗读一次（必须 HTTPS 或 localhost），确认：

1. `Words[]` 词级明细能正确解析并标红低分词；
2. 五分制用 `综合分 ÷ 20` 是否合理；`SuggestedScore` 缺失时按基础版公式 `accuracy × completion × (2 − completion)` 推算 —— 该公式**新版文档未明示**，需拿本校学生样本定标。

### 7.6 参数口径

`eval_mode=2`（段落，≤120 词，素材已控制在 80 词内）、`server_engine_type=16k_en`、`score_coeff` 默认 2.5（页面可切 1.5–3.5，需本校样本定标）、`sentence_info_enabled=1`（拿词级中间结果）。

> 智聆只返回**发音层**三维（准确度 / 流利度 / 完整度），不评语义与内容。信息转述这类考要点的题型，仍需自建 ASR + LLM 量规，接了智聆也不解决。
