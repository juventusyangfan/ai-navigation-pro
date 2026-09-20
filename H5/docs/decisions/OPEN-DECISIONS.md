# 悬而未决登记册（OPEN-DECISIONS）

> 规范：只追加 + 就地关闭（OPEN → RESOLVED 并补 Resolution）。
> 每次开工前，未决项应复现到工作上下文最前面，逐条判断能否关闭。

| Date | Source | Open Item | Related Constraints | Current Leaning | Blocked By | Resolves When | Status |
|------|--------|-----------|---------------------|-----------------|------------|---------------|--------|
| 2026-09-20 | Phase 1（服务端 TTS 落地） | 腾讯云语音合成尚未开通 | 未开通时 `/api/tts/audio` 返回 502 `UnsupportedOperation.ServerNotOpen`，前端降级展示听力原文 | 用大模型音色 501008/501009（免费额度 10 万字符） | waiting-on-external-condition：需在控制台开通并领取免费资源包 | 开通后 `npm run tts:check` 全绿 | OPEN |
| 2026-09-20 | Phase 1（服务端 TTS 落地） | 英文童声缺失：Boy/Girl 与 Man/Woman 只能按性别区分 | 腾讯云英文专用音色仅 3 个且无童声 | 先用 WeJames/WeWinny 按性别分声 | design-decision-to-evaluate：需试听超自然童声 403000 / 603002 的实际效果 | 试听后决定是否切超自然音色（单价约 5.4 倍、并发 10 路） | OPEN |
| 2026-09-20 | Phase 1（服务端 TTS 落地） | 是否替换为真人考试录音 | 合成音与真人录音有差距；体验卷可接受，正式考试前不宜 | 正式版采购真人录音，走 `audioUrl` 覆盖合成音频 | waiting-on-external-condition：需素材采购 | 拿到真人录音素材并入库 | OPEN |
| 2026-09-19 | 安全（历史遗留） | 腾讯云永久 SecretKey 曾在聊天中明文出现 | 生产已默认走 STS 临时密钥，但该密钥本身需作废 | 立即轮转，并改用子账号最小权限密钥（tts:TextToVoice + soe:SpeakingAssessmentStream） | waiting-on-external-condition：需在 CAM 控制台操作 | 完成密钥轮转并在 `.env` 更新 | OPEN |
