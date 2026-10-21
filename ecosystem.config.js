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
        NEXT_PUBLIC_SITE_ORIGIN: "https://radar.eanavi.com,https://h5.eanavi.com,https://admin.eanavi.com",
        // 作文测评后台看板：走 zuowen 的内部接口取数（同机回环，不出公网）。
        // ZUOWEN_CRON_TOKEN 属于密钥，写在 admin/.env 里（ecosystem 会被 git 跟踪），
        // 必须与 zuowen/.env 的 ZW_CRON_TOKEN 一致。
        ZUOWEN_BASE_URL: "http://127.0.0.1:3002",
        ZUOWEN_PUBLIC_BASE: "https://zuowen.eanavi.com"
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
    },
    {
      // 树蕙伴学 · 小学写作水平测评（服务号「写作水平测评」菜单入口）
      // 独立进程与独立数据库，与 admin / front 完全隔离：
      // 这个应用挂了不会影响主站，改它也碰不到别人的表。
      //
      // 密钥（ZW_LLM_API_KEY / ZW_TEXT_KEY / ZW_CRON_TOKEN）**不写在这里**，
      // 放在 /srv/app/ai-navigation-pro/zuowen/.env，由 Next.js 启动时自行加载。
      // ecosystem 会被 git 跟踪，任何写进来的密钥都等于提交到了仓库里。
      name: "zuowen",
      cwd: "/srv/app/ai-navigation-pro/zuowen",
      script: "npm",
      args: "run start",
      env: {
        PORT: 3002,
        NODE_ENV: "production",
        DATABASE_URL: "file:/srv/app/ai-navigation-pro/zuowen/prisma/dev.db"
      },
      max_memory_restart: "400M",
      error_file: "/srv/app/ai-navigation-pro/logs/zuowen-err.log",
      out_file: "/srv/app/ai-navigation-pro/logs/zuowen-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss"
    }
  ]
};
