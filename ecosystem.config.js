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
        // 赛事雷达的前端在两处挂载：
        //   1) 独立域名 radar.eanavi.com（根路径直接是雷达首页）
        //   2) 旧地址 h5.eanavi.com/radar/（保留，老链接与已推文不能失效）
        // 两者都要列进来，漏一个就会表现为前台一直停在「加载失败」——
        // 跨域被浏览器拦掉时，服务端日志里什么都看不到。
        NEXT_PUBLIC_SITE_ORIGIN: "https://radar.eanavi.com,https://h5.eanavi.com,https://admin.eanavi.com"
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
