#!/usr/bin/env bash
# H5 听说测评 · 腾讯云轻量服务器一键更新脚本
# 前置：项目已克隆到 /srv/app/ai-navigation-pro，且已完成 nginx-h5.conf 配置
# 用法：cd /srv/app/ai-navigation-pro/H5 && bash deploy/deploy.sh

set -euo pipefail

APP_DIR="/srv/app/ai-navigation-pro"
H5_DIR="${APP_DIR}/H5"
SITE_ROOT="${H5_DIR}/dist"

echo "[1/4] 拉取最新代码"
cd "${APP_DIR}"
git pull origin main || echo "  (git pull 失败，使用本地代码继续)"

echo "[2/4] 安装/更新依赖"
cd "${H5_DIR}"
npm install --no-audit --no-fund

echo "[3/5] 构建静态资源"
npm run build

echo "[4/5] 启动/保活后端服务（/api/soe/credential 凭证 + /api/tts/audio 语音合成）"
# 提示：听力音频依赖腾讯云语音合成，需先在控制台开通并领取免费资源包（README §8.3）
#      开通后可用 `npm run tts:check` 逐条自检合成结果
if command -v pm2 >/dev/null 2>&1; then
  pm2 describe h5-soe-cred >/dev/null 2>&1 && pm2 restart h5-soe-cred || pm2 start server/index.mjs --name h5-soe-cred
else
  # 无 pm2 时以 nohup 保活（生产建议用 pm2 / systemd 托管，避免进程退出）
  if ! pgrep -f "server/index.mjs" >/dev/null 2>&1; then
    nohup node server/index.mjs > /var/log/h5-soe-cred.log 2>&1 &
  fi
fi

echo "[5/5] 重载 Nginx"
sudo nginx -t && sudo systemctl reload nginx

echo "完成：站点目录 ${SITE_ROOT}"
echo "访问：https://h5.eanavi.com"
