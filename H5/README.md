# H5 听说测评（最小可用版）

移动端 H5 英语听说测评的最小开发框架：**测评页 + 结果分析页**，无登录、无支付、无后台、无后端服务。

技术栈：Vue 3 + Vite，生产依赖仅 `vue` 一个；路由用手写 hash 路由（静态托管零 rewrite 配置）。

---

## 一、启动命令

```bash
cd ai-navigation-pro/H5

npm install        # 安装依赖（含腾讯云 TTS / STS SDK）
npm run cert       # 生成自签 HTTPS 证书到 certs/（手机真机测录音必需；只需一次）
npm run server     # 本地服务：凭证下发 + 语音合成（:8787，dev 已把 /api 代理过来）
npm run dev        # 本地开发，https://localhost:5173（certs/ 存在时走 HTTPS）
npm run build      # 构建静态资源到 dist/
npm run preview    # 预览构建产物，http://localhost:4173

# 音频链路自检
npm run tts:check      # 真实调用腾讯云语音合成（需已开通，走缓存，可重复执行）
npm run verify:audio   # 播放链路实证（Playwright 模拟「无浏览器 TTS」的手机环境）
node --test scripts/test-tts.mjs   # 服务端合成逻辑单测
```

> Node 版本要求：18.18+ / 20+（本项目在 Node 22 下验证通过）。

**访问地址**

| 环境 | 地址 |
|---|---|
| 本地开发 | https://localhost:5173（未生成证书时自动降级 http://localhost:5173） |
| 本地预览构建产物 | http://localhost:4173 |
| 手机同局域网真机调试 | https://<电脑内网IP>:5173 （`npm run dev` 已开 `--host`） |
| 生产（腾讯云） | https://h5.eanavi.com |

> **注意：录音必须在安全上下文下才能用**：只有 `https://` 或 `localhost` 能调用麦克风。用内网 IP 直连 http 时 Chrome 会禁用麦克风 —— 真机测录音请先 `npm run cert` 再走 https，或访问生产 HTTPS 域名，或用 Chrome 的 `chrome://flags/#unsafely-treat-insecure-origin-as-secure` 临时放行。

**HTTPS 证书（`npm run cert`）**

- 脚本会自动探测 openssl（优先本机 Git 自带的 `PortableGit/usr/bin/openssl.exe`），生成 RSA-2048 / 365 天自签证书到 `certs/`，并把 `localhost`、`127.0.0.1` 与**本机全部局域网 IP** 写进 SAN，手机可直接访问。
- **证书不存在时 `npm run dev` 不会崩**，会自动降级 http 并在控制台提示（提示为纯 ASCII，避免 GBK 控制台乱码）。
- 自签证书浏览器会告警，点「高级 / 继续访问」即可；**iOS Safari 对自签证书常直接拒绝 getUserMedia**，真机优先用安卓 Chrome 或生产 HTTPS 域名。
- 机器上没有 openssl 时，脚本会给出安装指引（`winget install GnuWin32.OpenSSL` / `choco install openssl`，或改用 `mkcert`）。

**启动报错速查**

| 报错 | 原因 / 处理 |
|---|---|
| `ENOENT: no such file or directory, open '...\certs\key.pem'` | 配置引用了证书但还没生成。执行 `npm run cert`；新版配置已加降级，缺证书也会以 http 启动而不崩 |
| `TypeError: crypto$2.getRandomValues is not a function` | Node 版本过低（<18）。`nvm install 22 && nvm use 22`，`npm run dev` 前会自动预检 |
| 端口被占用 | 换端口：`npm run dev -- --port 5174` |

**运行时报错速查**

| 现象 | 原因 / 处理 |
|---|---|
| 播放听力提示「服务端合成音频加载失败（非网络问题）」 | **先跑 `npm run tts:check`**，它会直接打出上游原因。此提示已刻意不提网络——音源是服务端合成时，失败几乎不可能是用户网络 |
| `The SecretId is not found` / `AuthFailure.SecretIdNotFound` / 智聆 `code:4002` | **密钥已被删除或禁用**，不是服务未开通。到 https://console.cloud.tencent.com/cam/capi 检查该 SecretId 状态，重新启用或新建后更新 `server/.env`。⚠️ 智聆评测与语音合成共用同一套 CAM 鉴权，**会同时失效** |
| `UnsupportedOperation.ServerNotOpen` | 语音合成未开通：https://console.cloud.tencent.com/tts 开通并领取免费资源包 |
| `/api/tts/audio` 返回 403 | 该文本不在题库白名单（防配额盗刷）。属预期行为，改用题库内文本即可 |

> 判定密钥是否失效的可靠方法：用**正确 SecretId + 任意错误 SecretKey** 调一次 CAM。若仍返回 `SecretIdNotFound`（而非签名错误），即可确认该密钥在 CAM 已不存在/被禁用。

---

## 二、页面与路由

| 路由 | 页面 | 能力 |
|---|---|---|
| `#/`（默认） | `src/pages/Assessment.vue` 测评页 | **年级选择**后加载对应完整试卷；听力播放（TTS/音频）、口语题（模仿朗读/情景交际/信息转述）全部调用智聆真评（SDK 内置录音+评测+计时+回放）、选择题本地判分、逐题提交，产出结构化作答数据 |
| `#/result` | `src/pages/Result.vue` 结果分析页 | 总分、五大维度得分条、逐题明细与录音回放、规则化改进建议 |

试卷数据（`src/data/paper.js`，按年级导出 `GRADES` + `papers` + `getPaper()`），每套含四个题型、与中考听说框架对齐：

1. 听后选择（客观题，本地判分）
2. 模仿朗读（智聆评发音）
3. 情景交际 / 口头表达（智聆评发音，参考范文作 ref_text）
4. 信息转述（智聆评发音，参考转述范文作 ref_text）

| 年级 | 满分 | 听后选择 | 模仿朗读 | 情景交际 | 信息转述 |
|---|---|---|---|---|---|
| 七年级 | 30 | 10（2 题） | 5（1 篇） | 5（1 题） | 10（1 题） |
| 八年级 | 36 | 12（3 题） | 6（1 篇） | 6（2 题） | 12（1 题） |
| 九年级 | 40 | 12（3 题） | 8（1 篇） | 8（2 题） | 12（1 题） |

---

## 三、部署到腾讯云（沿用现有轻量服务器 + Nginx 子域名方案）

现有服务器已部署 `front(:3000)` / `admin(:3001)`。前端仍为纯静态 `dist`，由 Nginx 托管；但智聆评测需要浏览器端拿到密钥，故**额外运行密钥服务** `server/index.mjs`（默认 :8787），并由 Nginx 反代 `/api`（见 `deploy/nginx-h5.conf`）。`deploy/deploy.sh` 已包含「构建 → 启动/保活密钥服务 → 重载 Nginx」三步。

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

> 密钥服务（评测必需）：部署前先 `cp server/.env.example server/.env` 并填入真实 `SOE_APPID / SOE_SECRET_ID / SOE_SECRET_KEY`；`deploy.sh` 会自动用 pm2（或 nohup）保活 `server/index.mjs`（:8787），Nginx 已配置 `/api` 反代。**生产环境务必改用 STS 临时密钥**（§7.4），不要把永久密钥下发到公网浏览器。
>
> 语音合成（听力音频必需）：需先在 https://console.cloud.tencent.com/tts 开通并**领取免费资源包**（不会自动发放），密钥与智聆共用；未开通时 `/api/tts/audio` 返回 502、页面降级展示听力原文（详见 §8.3）。开通后跑 `npm run tts:check` 验收。

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
│   ├── check-node.mjs             # Node 版本预检（ASCII 输出，低版本也能运行）
│   ├── check-tts.mjs              # 真实调用云合成自检（逐条合成题库音频）
│   ├── test-tts.mjs               # 服务端合成逻辑单测（切段/拼接/缓存键/校验/Range）
│   └── verify-audio-playback.cjs  # 播放链路实证（Playwright 模拟无 TTS 的手机环境）
├── server/
│   ├── index.mjs             # HTTP 入口：只装配路由（/api/soe/*、/api/tts/*）
│   ├── soe.mjs               # 智聆凭证：STS 临时密钥 / 本地调试静态密钥
│   ├── tts.mjs               # 腾讯云语音合成：角色分声 / 调用 / 拼接 / 缓存 / 白名单 / 限流
│   ├── http-util.mjs         # 传输层工具：JSON与二进制响应、Range、请求体、.env 加载
│   ├── .cache/tts/           # 合成音频磁盘缓存（含 .json 审计元数据，已 gitignore）
│   └── .env.example          # SOE_* / TTS_* 配置样例
├── public/
│   ├── vendor/
│   │   └── TencentSOE-1.0.1.js # 腾讯云官方 SOE Web SDK（v1.0.1，需 type="module" 加载）
│   └── favicon.svg             # 站点图标（声波图形，非 emoji）
├── deploy/
│   ├── nginx-h5.conf         # Nginx 站点配置（h5.eanavi.com，含缓存与安全头）
│   └── deploy.sh             # 服务器一键更新脚本
├── dist/                     # 构建产物（部署目录，已 gitignore）
└── src/
    ├── main.js               # 应用入口
    ├── App.vue               # 外壳：头部 + 安全上下文告警 + 路由出口
    ├── router.js             # 极简 hash 路由（无 vue-router 依赖）
    ├── styles/main.css       # 移动端样式（CSS 变量，无 UI 框架）
    ├── data/
    │   └── paper.js          # 多年级试卷数据（GRADES + papers + getPaper；音频由服务端按 audioText 合成）
    ├── services/
    │   ├── audioPlayer.js    # 题目音频播放：真人录音优先，其次服务端语音合成（无浏览器 TTS）
    │   ├── player.js         # 录音回放：原生播放 + duration 修复 + WebAudio 降级
    │   ├── evaluator.js      # 评分：选择题判分 + 口语题消费智聆真实结果 + 报告汇总 + 建议
    │   ├── store.js          # 结果存储（localStorage）与音频 URL 内存缓存
    │   └── soeSdk.js         # 智聆 Web SDK 封装：加载 SDK、取密钥、发起评测、解析结果
    └── pages/
        ├── Assessment.vue    # 测评页
        └── Result.vue        # 结果分析页
```

---

## 五、评分已切到智聆真评（新版 Web SDK）

全部口语题（模仿朗读 / 情景交际 / 信息转述）均通过 `src/services/soeSdk.js` 调用腾讯云智聆口语评测（新版）Web SDK，由 SDK 内置录音并直连 `wss://soe.cloud.tencent.com` 完成评测。初始化参数与 2026-09-18 调试记录一致（`eval_mode=2` 段落 / `server_engine_type=16k_en` / `score_coeff=2.5` / `sentence_info_enabled=1` / `text_mode=0`），七/八/九年级体验卷共用同一套 `startReadAloud()`。`src/services/evaluator.js` 现在只做报告汇总，**不再做任何本地模拟评分**（mock 的 `evaluateSpeech` 与未启用的服务端路径 `evaluateByServer` 均已删除）。

- 智聆仅返回发音层三维分（准确度 / 流利度 / 完整度），**不评语义与内容**；情景交际 / 信息转述的内容分需业务侧另建 ASR + LLM 量规，当前「要点覆盖」维度显示为 0，属真实情况，不作假。
- 密钥由自建后端 `/api/soe/credential` 下发（详见 §七与 `server/index.mjs`）；浏览器端不持有 SecretKey 的明文构造逻辑，调试模式（`SOE_ALLOW_STATIC=1`）会下发永久密钥，生产默认走 STS 临时密钥（见 §7.4）。

> 智聆新版硬约束备忘：音频 16kHz/16bit/单声道，pcm/wav/mp3(≥32kbps)/speex；单次最长 300s；默认单账号并发 50 路（超出 30 元/路/月）；发送节奏 1:1 实时率。

---

## 六、已知限制（MVP 范围内）

- 题目音频由**服务端腾讯云语音合成**生成（见 §八），音色为云端 TTS、与考试真人录音仍有差距；正式版建议换真人录音——给题目加 `audioUrl` 并放入 `public/audio/` 即可覆盖，代码零改动。
- 录音保留在当前会话内存（blob + blob URL），刷新页面后回放失效；结果结构化数据存 localStorage。
- 试听不用原生 `<audio controls>`：MediaRecorder 产出的容器缺 duration（原生拿到的 `duration` 是 `Infinity`），会导致进度条失效、iOS Safari 点了不响。`services/player.js` 先修 duration，修不好就降级到 WebAudio `decodeAudioData` 播放（UI 会标注「兼容模式」）。
- 智聆评测结果仅供练习反馈，不代表任何考试的实际得分或预测；对外口径须遵守合规红线（结果页已内置免责声明，详见 §3.3）。
- 题目音频依赖腾讯云语音合成，**需在控制台开通并领取免费资源包**；未开通时听力音频不可用，页面降级展示听力原文（见 §8.3）。
- 未实现：登录、支付、后台管理、题库管理、班级/作业、音频上传服务端留存。

---

## 七、全题型 · 智聆真评闭环

测评页（`#/`）的**全部口语题型**统一走腾讯云官方 Web SDK：用户选择年级 → 加载该年级完整试卷 → 每道口语题录音 → 智聆返回发音层三维分 + 词级明细 → 结果页汇总。现有的「模仿朗读」独立 demo 页已移除，所有口语评测收敛到 `Assessment.vue` 一套 `startReadAloud()`。

> 初始化参数（`soeSdk.js`）：`eval_mode=2` 段落模式（≤120 词）、`server_engine_type=16k_en`、`score_coeff=2.5`、`sentence_info_enabled=1`、`text_mode=0`，与 2026-09-18 调试记录一致。情景交际 / 信息转述在 `paper.js` 中额外提供「参考范文」作为智聆的 `ref_text`（评发音用），内容/语义分仍需业务侧另建 ASR + LLM 量规。

### 7.1 技术选型（已核实）

官方新版 SDK 只有 Android / iOS 客户端与 Python / Java / Go 服务端，**Web 端唯一官方 SDK 是这个 JS SDK**：
`https://github.com/TencentCloud/tencentcloud-speech-sdk-js`（`soe` 目录，v1.0.1，包名 `soenew-sdk-js`，未发 npm，故已把 dist 存到 `public/vendor/TencentSOE-1.0.1.js`）。

- SDK 内部已封装：麦克风采集 → 重采样 16k/16bit/单声道 PCM → 分片节奏 → **HMAC-SHA1 签名** → WSS 收发。所以我们不自己撸 WebSocket。
- 主类 `SowNewSocketSdk`（内置录音）；`SoeNewConnect`（自带音频，`write(data)`）。回调用 `OnEvaluationStart / OnEvaluationResultChange / OnEvaluationComplete / OnError / OnRecorderStop`。
- **坑（已修）**：官方 dist 末尾带 `export{w as default}`，是 webpack module 产物，用经典 `<script>` 加载必报 `Unexpected token 'export'`，必须 `type="module"` 加载（模块体内仍会挂 `window.SowNewSocketSdk`）。

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
npm run dev        # H5  http://localhost:5173/#/
```

未配置密钥时测评页会明确提示「去配置密钥服务」，不提供任何模拟数据回退（已彻底弃用本地体验功能）。

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
| 默认（不设置 `SOE_ALLOW_STATIC`） | **生产模式**：`/api/soe/credential` 走 STS，返回临时三件套（TmpSecretId / TmpSecretKey / Token），永久密钥留服务端，浏览器直连腾讯云时携带 `&token=` |
| `SOE_ALLOW_STATIC=1` | 仅本地调试，把永久密钥下发给浏览器（启动时打警告）；**禁止用于生产环境** |
| `SOE_STS_ROLE_ARN=任意值` | 强制走 STS（即便 `SOE_ALLOW_STATIC` 误设为 1），作为兜底开关 |

正式上线**默认即走 STS 临时密钥**（本地实测已返回 200 + 临时三件套）；若误开 `SOE_ALLOW_STATIC=1`，永久密钥下发到浏览器等于把账号交出去。

### 7.5 已验证 / 未验证

已验证（本机 Chromium 实测）：SDK 加载成功（`SowNewSocketSdk`/`SoeNewConnect` 均为 function）、密钥服务与 Vite 代理联通、未配置密钥的降级引导、报告 UI 渲染、AppId 由 CAM `GetUserAppId` 取回（1315596766）。

**真实调用已跑通（2026-09-18，AppId 1315596766）**：WSS 握手成功、服务端返回 `code:0` 且 `final:1`，完整链路闭环。过程中修掉两个真实问题：

1. **页面永远卡在「评测中」**：`stop()` 只 `await c.done` 却**没调 `c.stop()`**，SDK 不发 `{"type":"end"}`，服务端等不到结束信号就永不返回最终结果。已修（`Assessment.vue` 的 `stopRecord()` 先调 `c.stop()` 再 await）。排查手法：Playwright 监听 `page.on('websocket')` 的 framesent/framereceived，能直接看到"音频帧一直发、服务端只回了 initial 那条"。
2. **无效语音会显示莫名的 0 分**：无有效人声时服务端回 `SuggestedScore=0 / PronAccuracy=0 / PronCompletion=0 / PronFluency=-1 / Words=[]`。`normalizeResult` 已加 `noSpeech` 判定，页面改提示"未检测到有效语音，本次不计分"。
3. **录完没有「试听录音」按钮**：SDK 的 `OnRecorderStop` 回传的**不是 `ArrayBuffer`**，而是 WebRecorder 用 `allAudioData.push(...new Int8Array(chunk))` 累积出来的**普通数组**（实测 2.4s 音频 ≈ 77486 个字节元素）。旧代码只认 `ArrayBuffer`/TypedArray，于是 `pcmToWavRec()` 直接返回 `null` → `answers[id].rec` 为空 → 模板 `v-if="answers[current.id]?.rec"` 不放行，试听入口整个消失（早期用 MediaRecorder 的版本不会踩到，因为拿到的是真 Blob）。已加 `soeSdk.toArrayBuffer()` 统一兼容三种形态，页面与结果页共享该归一化器。定位手法：在 `OnRecorderStop` 里把 `typeof / Array.isArray / constructor.name / length` 挂到 `window` 上，Playwright 用 `page.evaluate` 读回来即可确定形态。

**一个被推翻的假设**：`result` 字段**不是** Go 结构体风格字符串，新版 SDK 回传的已是**解析好的 JSON 对象**（`soeSdk.js` 保留字符串分支仅作兜底）。

4. **手机端「播放录音」点了没声音、只减少剩余次数**（2026-09-19 定位）：当时听力/示范音频**没有真实音频素材**，只能走 Web Speech TTS（`audioPlayer.js`）。移动端 TTS 极不可靠——微信 X5 / 各类 WebView 对 `speechSynthesis` 支持残缺，且**失败几乎都是静默的**：既不触发 `onend`，也不触发 `onerror`。旧实现有两处致命写法：
   - `utter.onerror = () => resolve()` 把「合成失败」当成「播放结束」→ 上层 `await play(item)` 正常返回 → **扣次数、没声音、无提示**（这正是线上现象：PC 能播、手机只扣次数）；
   - 判定成功的标准是「播完」（`onend`），而静默失败时 `onend` 永不触发 → Promise 永久 pending → 按钮卡死「播放中…」且再也点不动。

   现改为（`audioPlayer.js` 重写）：
   - **只有 `onstart` 才算「真的出声」**——`play(item, { onStart })` 把扣次数绑定在 `onStart` 上，而不是「点击即扣」或「播完才扣」；
   - `speak()` 后 **1200ms 无任何回调 → 判定 `TTS_SILENT` 失败**，不再永久挂起；
   - 失败**一律不扣次数** + 给出可操作提示（`describePlayError`）+ 降级展示听力原文（否则该题既听不到也读不到，完全无法作答）；
   - `onerror` 的 `interrupted` / `canceled` 视为「我们自己停的」按正常结束处理，不再误报；
   - iOS 竞态：**首次播放必须同步 `speak()`**（留在用户手势栈内），只有**已成功播放过一次**之后才允许 `cancel()` + 退一帧再 `speak()`（iOS 上 `cancel()` 紧跟 `speak()` 会吞音）；`cancel()` 因此从 `play()` 里移出，交给 `playTts` 按状态决定；
   - 首次用户手势内调 `unlockAudio()` 预热解锁音频通道（iOS/WebView 必需，用 WebAudio 播 1 帧静音 + 初始化 `voiceschanged`）；
   - `visibilitychange` / `pagehide` 时停止播放并复位 `playing`，避免切后台回来后按钮卡死；
   - 播放次数落 `sessionStorage`（按试卷 id 隔离），刷新页面不重置，防刷新绕过。

   定位手法：用 Playwright 模拟移动端（`devices['iPhone 13']`）+ `addInitScript` 把 `speechSynthesis` 桩成三种行为——`ok`（`onstart→onend`）/ `error`（立即 `onerror`，微信真实表现）/ `silent`（无任何回调），断言「剩余次数是否被扣 + 按钮状态 + 是否有提示」。

   **2026-09-20 第一阶段（本地静态音频，次日按业务要求回退）**：曾用本地脚本（edge-tts）预生成 14 条 mp3 入库、由 `paper.js` 自动挂载 `audioUrl`，移动端改走原生 `<audio>`，确实解决了播放问题；但该方案要求「音频与题库两份数据保持同步」——改题目必须重跑脚本，体积随题库线性增长，**已回退**，改为服务端腾讯云语音合成（见第八章）。同批修掉的两个问题仍有效并保留：

   5. **有音频却永远匹配不上**：`attachAudio()` 误把 `paper.id`（试卷 id，形如 `demo-grade7-001`）当年级键，与 `AUDIO_KEYS` 里的 `grade7` 语义不同 → 注入的 `audioUrl` 恒为空，实际仍走 TTS。已改用 `papers` 的键（`grade7/8/9`）。**这类「同名不同义」的 bug 静态读代码很难发现，是靠实证脚本「0 个 mp3 请求」这条断言抓出来的。**
   6. **播放中切题会把下一题的按钮永久卡死**：`next()/prev()` 调 `stopAll()` 后，挂起的 `playFile` Promise 永不 settle → `playCurrent` 的 `finally` 不执行 → `playing` 恒为 `true`，按钮一直显示「播放中…」且不可点。已加 `currentAbort` 机制：`stopAll()` 主动终结挂起播放（抛 `PLAY_ABORTED`），调用方对该 code 静默忽略（不算失败、不提示、不降级展示原文）。

   同时给 `playFile` 补了弱网守卫（8s 未出声即判失败、可重试，避免永远停在「播放中…」）和 `preloadAudio()` 切题预取。

   > 移动端可靠播放的**判据只有一条**：音频由**服务端或真实文件**提供 + 原生 `<audio>` 播放。任何依赖 `speechSynthesis` 的方案在微信 X5 / 各类 WebView 上都不可靠，且失败是静默的（无 `onend` 也无 `onerror`）。

   7. **回退本地静态音频，改服务端腾讯云语音合成**（2026-09-20 晚）：新增 `server/tts.mjs`（TextToVoice 调用、角色分声、mp3 拼接、磁盘缓存、文本白名单、限流）与 `/api/tts/health`、`/api/tts/audio` 路由；`audioPlayer.js` 重写，**删除全部 `speechSynthesis` 分支**，音源优先级改为「真人录音 > 服务端合成 > 明确提示」；同步删除本地合成脚本与 `public/audio/` 产物。服务端按职责拆分为 `soe.mjs`（凭证）/ `tts.mjs`（合成）/ `http-util.mjs`（传输）/ `index.mjs`（仅装配路由）。

**仍需真人录音验证**：本机 Chromium 假麦克风发的是蜂鸣声（非人声），所以拿不到有效分数，`Words` 数组解析与五分制定标还没被真实数据校验过。请在浏览器里真实朗读一次（必须 HTTPS 或 localhost），确认：

1. `Words[]` 词级明细能正确解析并标红低分词；
2. 五分制用 `综合分 ÷ 20` 是否合理；`SuggestedScore` 缺失时按基础版公式 `accuracy × completion × (2 − completion)` 推算 —— 该公式**新版文档未明示**，需拿本校学生样本定标。

### 7.6 参数口径

`eval_mode=2`（段落，≤120 词，素材已控制在 80 词内）、`server_engine_type=16k_en`、`score_coeff` 默认 2.5（页面可切 1.5–3.5，需本校样本定标）、`sentence_info_enabled=1`（拿词级中间结果）。

> 智聆只返回**发音层**三维（准确度 / 流利度 / 完整度），不评语义与内容。信息转述这类考要点的题型，仍需自建 ASR + LLM 量规，接了智聆也不解决。

---

## 八、题目音频：服务端腾讯云语音合成（TTS）

**结论：题目音频由服务端调用腾讯云语音合成生成，浏览器只做原生 `<audio>` 播放，前端不依赖任何浏览器语音能力。**

两条被否掉的路线：

| 方案 | 结果 |
|---|---|
| 浏览器 `speechSynthesis`（Web Speech TTS） | 手机端（微信 X5 / 各家 WebView）支持残缺且**失败静默**（既不 `onend` 也不 `onerror`），必然表现为「扣了次数没声音」——已废弃 |
| 本地脚本预生成 mp3 入库（edge-tts，曾用方案） | 音频与题库是两份数据，改题目即失同步；体积随题库线性增长；音色固定——**已回退** |

现方案与「真人录音 + 原生 `<audio>`」走的是同一条最可靠路径，且音频**随题目文本自动生成**，不存在同步问题。

### 8.1 调用流程（端到端）

```
浏览器                        服务端 server/index.mjs              腾讯云
  │ ① GET /api/tts/health          │                                 │
  │────────────────────────────────>│ 返回 enabled/configured/library │
  │ ② 进入某题：preloadAudio()      │                                 │
  │ ③ GET /api/tts/audio?text=…&voice=auto                            │
  │────────────────────────────────>│                                 │
  │                                 │ ④ 磁盘缓存命中 → 直接回音频      │
  │                                 │ ⑤ 未命中：按角色切段             │
  │                                 │── TextToVoice(Text/VoiceType…) ─>│
  │                                 │<── 逐段 base64 mp3 ──────────────│
  │                                 │ ⑥ 剥 ID3 后拼接为单条 mp3        │
  │                                 │ ⑦ 写 server/.cache/tts（含审计） │
  │<── audio/mpeg（immutable + ETag + Range 支持）────────────────────│
  │ ⑧ <audio> 播放 → playing 事件 → 此时才扣减播放次数                 │
```

- **前端不持有任何云密钥**，只请求同源 `/api/tts/audio`（Nginx 反代到 `:8787`）；密钥只存在于服务端 `.env`。
- 同一文本第二次请求命中服务端磁盘缓存（0 次云端调用），浏览器侧另有 `immutable` 强缓存。
- 缓存键 = `sha1(音色配置 | 语速 | 采样率 | 文本)`；换音色会自动重新合成，不会串音。

### 8.2 腾讯云接口与参数映射

接口：`tts.tencentcloudapi.com`，`Action=TextToVoice`，`Version=2019-08-23`（[官方文档](https://cloud.tencent.com/document/api/1073/37995)）

| 参数 | 本项目取值 | 说明 |
|---|---|---|
| `Text` | 题目原文（含 `Boy:` / `Woman:` 角色前缀） | 英文 ≤500 字母 / 中文 ≤150 汉字；本仓库题目最长 **415 字符**，单段足够 |
| `SessionId` | 随机 UUID | 官方要求防重复；配合 `RequestId` 可追溯 |
| `ModelType` | `1` | 默认模型 |
| `VoiceType` | `501008`（男）/ `501009`（女） | 见 §8.4 音色选型 |
| `PrimaryLanguage` | `2` 英文（文本含中文时自动切 `1`） | 题目均为英文 |
| `SampleRate` | `24000`；精品音色自动降 `16000` | 大模型音色支持 24k，精品音色最高 16k |
| `Codec` | `mp3` | 体积小、浏览器原生支持、可 Range |
| `Speed` | `0`（1.0 倍速） | 取值 [-2, 6]，可用 `TTS_SPEED` 微调听力语速 |

**角色分声**（避免「一人分饰两角」误导学生）：服务端解析 `audioText` 里的说话人前缀，逐段选音色、分别合成后拼成一条 mp3：

| 前缀 | 音色槽 | 默认音色 |
|---|---|---|
| `Boy:` / `Man:` | male | 501008 WeJames |
| `Girl:` / `Woman:` | female | 501009 WeWinny |
| `Narrator:` / 无前缀 | narrator | 501009 WeWinny |

超长文本（>480 字符）先按句、再按逗号二级切分，确保每次请求都在 `Text` 限制内；多段结果**剥离 ID3 头后二进制拼接**为单条 mp3（帧流连续，中间不出现元数据块）。

### 8.3 接口配置（开通 / 密钥 / 环境变量）

**第一步：开通语音合成**——当前**尚未开通**，直接调用会返回 `UnsupportedOperation.ServerNotOpen`（本项目已翻译为可读中文提示）：

1. 打开 https://console.cloud.tencent.com/tts 点「开通」；
2. 到 https://console.cloud.tencent.com/tts/resourcebundle **领取免费资源包**（不会自动发放）；
3. 免费额度：大模型音色 **10 万字符**、超自然大模型音色 2 万字符、精品音色 800 万字符；**领取后 3 个月内有效，一个账号只能领一次**；
4. 额度用尽后需购买资源包或开通后付费（后付费默认关闭，不会自动转）。

**成本口径**（按本项目实际文本量估算）：

| 项 | 值 |
|---|---|
| 三套卷全部听力/示范文本 | 14 条 / 约 **3,000 字符**（空格与标点均按一个字符计） |
| 大模型音色（当前选型） | 后付费 1.2 元/万字符（0–10 万字符/日）；**单套卷约 0.36 元** |
| 免费额度覆盖 | 10 万 ÷ 3,000 ≈ **33 套卷**（3 个月内，含反复重合成） |
| 精品音色（备选） | 0.3 元/万字符、免费额度 800 万字符，但只有男声且最高 16k |

> 磁盘缓存 + 浏览器强缓存意味着：**同一题目同一音色只在首次播放时产生一次云调用**，学生复看、刷新、重听都不再计费。

**第二步：配置密钥**（与智聆共用同一对腾讯云密钥，也可单独指定）：

```bash
cp server/.env.example server/.env
# 填 SOE_APPID / SOE_SECRET_ID / SOE_SECRET_KEY（TTS 默认复用这一对）
```

| 环境变量 | 默认 | 说明 |
|---|---|---|
| `TTS_ENABLED` | `1` | `0` 关闭合成接口（返回 503） |
| `TTS_SECRET_ID` / `TTS_SECRET_KEY` | 复用 `SOE_*` | 需要独立密钥时填写 |
| `TTS_VOICE_MALE` | `501008` | 男声（Boy / Man） |
| `TTS_VOICE_FEMALE` | `501009` | 女声（Girl / Woman） |
| `TTS_VOICE_NARRATOR` | `501009` | 旁白 / 无标记文本 |
| `TTS_SPEED` | `0` | 语速，[-2, 6] |
| `TTS_SAMPLE_RATE` | 空（自动） | 空 = 大模型音色 24k / 精品音色 16k |
| `TTS_CACHE_DIR` / `TTS_CACHE_MAX_MB` | `.cache/tts` / `64` | 磁盘缓存目录与上限（超限按 LRU 淘汰至 80%） |
| `TTS_ALLOW_ANY_TEXT` | `0` | `0` = 仅允许题库文本（防配额盗刷）；`1` = 允许任意文本 |
| `TTS_MAX_CONCURRENCY` | `4` | 进程内并发闸门（云端默认 20 路） |
| `TTS_RATE_PER_MIN` | `120` | 单 IP 每分钟请求上限 |

**子账号密钥**需授予 `tts:TextToVoice`（语音合成）与 `soe:SpeakingAssessmentStream`（智聆评测）两个动作权限。

### 8.4 音色选型（英文音色只有 3 个，这是硬约束）

| VoiceType | 名称 | 类型 | 语言 | 采样率 |
|---|---|---|---|---|
| `501008` | WeJames（外语男声） | 大模型音色 | 英文 | 8k / 16k / 24k |
| `501009` | WeWinny（外语女声） | 大模型音色 | 英文 | 8k / 16k / 24k |
| `101050` | WeJack（英文男声） | 精品音色 | 英文 | 8k / 16k |

**腾讯云没有英文童声**，因此 `Boy`/`Girl` 与 `Man`/`Woman` 只能按**性别**区分，同性别角色共用同一声音。

若必须区分童声：超自然大模型音色中的「中英文」童声可读英文（`403000` 云小朵 女童 / `603002` 软萌心心 男童 / `502007` 智小虎 童声），代价是单价升至 6.5 元/万字符（约 5.4 倍）、默认并发降至 10 路。切换只需改 `TTS_VOICE_MALE` / `TTS_VOICE_FEMALE`，代码零改动。

### 8.5 可靠性与防滥用

| 机制 | 实现 |
|---|---|
| 文本白名单 | 默认只允许题库内文本（`TTS_ALLOW_ANY_TEXT=0`），公开接口无法被用来刷配额 |
| 单 IP 限流 | 每分钟 120 次（`TTS_RATE_PER_MIN`），超限返回 429 |
| 并发闸门 | 进程内最多 4 路（`TTS_MAX_CONCURRENCY`），不把云端 20 路并发打满 |
| 磁盘缓存与审计 | `server/.cache/tts/*.mp3` + 同名 `.json`（记录音色、段数、时间、字节数），可对账 |
| 上游错误翻译 | `ServerNotOpen` / `NoFreeAccount` / `PkgExhausted` / `AccessLimit` / `VoiceType` 等均转为可操作中文提示 |
| Range 支持 | `/api/tts/audio` 支持 `Range` 请求（206），`<audio>` 预载与拖动更稳 |
| 前端降级 | 合成不可用 → 提前提示「服务端语音合成暂不可用」并展示听力原文，**且不扣播放次数** |
| Nginx 超时 | `proxy_read_timeout` 由 10s 调整为 **30s**（首次合成 + 多段拼接可能超过 10s） |

### 8.6 播放侧实现要点（`services/audioPlayer.js`）

| 机制 | 作用 |
|---|---|
| 音源优先级 | `item.audioUrl`（真人录音）> 服务端合成 `/api/tts/audio` > 明确提示；**已彻底移除 `speechSynthesis` 分支** |
| 能力预探测 | 页面加载调 `/api/tts/health`，未就绪即提前降级展示原文，不让用户白等超时 |
| 扣次数绑定「确认出声」 | `onStart` 由 `<audio>` 的 `playing` 事件触发：**没出声就不扣次数** |
| 失败不扣 + 可操作提示 | `describePlayError()` 区分「合成不可用 / 加载失败 / 被浏览器拦截」 |
| 弱网守卫 | 8s 未出声即判失败并可重试，避免永远停在「播放中…」 |
| 中断终结 | `stopAll()` 主动 reject 挂起的播放（`PLAY_ABORTED`），切题不会卡死下一题 |
| 切题预取 | `preloadAudio(item)` 触发服务端合成并预热浏览器缓存（不播放、不扣次数） |
| 播放次数持久化 | 落 `sessionStorage`（按试卷 id 隔离），刷新不重置 |

### 8.7 验证

```bash
# 1) 服务端合成逻辑单测（不依赖网络与开通状态，14 项）
node --test scripts/test-tts.mjs

# 2) 播放链路实证（Playwright + 系统 Chrome + iPhone 13 + 抹掉 speechSynthesis，27 项）
npx vite preview --port 4180 --host
NODE_PATH=<playwright-core 所在 node_modules> BASE=http://127.0.0.1:4180 \
  node scripts/verify-audio-playback.cjs

# 3) 真实云合成自检（需已开通；走磁盘缓存，重复执行几乎零成本）
npm run tts:check

# 4) 一键确认云端是否已开通（probe.ok=false 时附具体原因）
curl -s "http://127.0.0.1:8787/api/tts/health?probe=1"
```

当前状态（2026-09-20）：单测 **14/14 通过**；播放链路实证 **27/27 通过**（含「合成不可用时的降级」场景）；**真实云合成待控制台开通后跑第 3 步验收**。

### 8.8 换真人录音（正式版方向）

给题目条目加 `audioUrl`（相对路径即可），其**优先级高于服务端合成**，代码零改动：

```js
{ id: 'L1', audioText: '…', audioUrl: 'audio/grade7/listening-L1.mp3', … }
```

把真人录音放进 `public/audio/`，由 Nginx 直接托管，连服务端合成都不会触发。
