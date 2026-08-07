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
        DATABASE_URL: "file:/srv/app/ai-navigation-pro/admin/prisma/dev.db"
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
