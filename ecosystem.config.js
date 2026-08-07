module.exports = {
  apps: [
    {
      name: "admin",
      cwd: "/srv/app/ai-navigation-pro/admin",
      script: "npm",
      args: "run start",
      env: { PORT: 3001, NODE_ENV: "production", DATABASE_URL: "file:/srv/app/ai-navigation-pro/admin/prisma/dev.db" }
    },
    {
      name: "front",
      cwd: "/srv/app/ai-navigation-pro/front",
      script: "npm",
      args: "run start",
      env: { PORT: 3000, NODE_ENV: "production", INTERNAL_API_BASE: "http://127.0.0.1:3001" }
    }
  ]
};