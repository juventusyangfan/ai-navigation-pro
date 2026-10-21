import { PrismaClient } from "@prisma/client";

// Next.js 开发模式会热重载模块，每次都 new 一个 PrismaClient 会耗尽 SQLite 连接，
// 所以挂到 globalThis 上复用。
const g = globalThis as unknown as { __zwPrisma?: PrismaClient };

export const prisma =
  g.__zwPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "production" ? ["error"] : ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") g.__zwPrisma = prisma;
