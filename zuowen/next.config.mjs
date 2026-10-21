/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 默认 .next；本地验收时可用 NEXT_DIST_DIR 指定别的目录，
  // 避免与已经占着默认 .next 的进程互相踩（生产环境不设置，行为不变）。
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // 作文图片走 data URL 提交（不落盘），Node 默认 1MB 的 body 限制不够用，
  // 放宽到 8MB；前端已把长边压到 1600px、质量 0.8，正常一张在 300KB 以内。
  experimental: {
    serverActions: { bodySizeLimit: "8mb" },
  },
};

export default nextConfig;
