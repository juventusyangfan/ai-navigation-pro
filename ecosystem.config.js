module.exports = {
  apps: [
    {
      name: "admin",
      cwd: "/srv/app/ai-navigation-pro/admin",
      script: "npm",
      args: "run start",
      env: {
        PORT: 3001,
        NODE_ENV: "production",
        DATABASE_URL: "file:/srv/app/ai-navigation-pro/admin/prisma/dev.db",
        // 公开内容 API 的 CORS 白名单（逗号分隔）。
        // 赛事雷达的静态壳挂在 h5.eanavi.com/radar/，跨域取 /api/content/radar，
        // 不把该域名列进来，浏览器会直接拦掉请求，表现为前台一直停在「加载失败」。
        NEXT_PUBLIC_SITE_ORIGIN: "https://h5.eanavi.com,https://admin.eanavi.com"
      },
      max_memory_restart: "500M",
      error_file: "/srv/app/ai-navigation-pro/logs/admin-err.log",
      out_file: "/srv/app/ai-navigation-pro/logs/admin-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss"
    },
    {
      name: "front",
      cwd: "/srv/app/ai-navigation-pro/front",
      script: "npm",
      args: "run start",
      env: {
        PORT: 3000,
        NODE_ENV: "production"
      },
      max_memory_restart: "500M",
      error_file: "/srv/app/ai-navigation-pro/logs/front-err.log",
      out_file: "/srv/app/ai-navigation-pro/logs/front-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss"
    }
  ]
};
