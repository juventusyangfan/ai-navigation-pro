/**
 * Route Handler 的统一异常兜底（通用版）。
 *
 * 与 src/lib/radar/route-guard.ts 同一套思路，独立成通用模块是为了让新模块
 * 不必复用 radar 的命名与日志前缀（日志里出现 `[radar:...]` 而实际是作文接口，
 * 排查时会先怀疑错模块）。
 *
 * 核心原因再写一遍：Next.js 生产环境对 Route Handler 的未捕获异常返回
 * **HTTP 500 + 空 body**，前端 res.json() 抛 "Unexpected end of JSON input"，
 * 这条报错和真实原因无关，能把人带偏一整轮。所以凡是碰数据库或外部 IO 的接口，
 * 出口必须是 JSON。
 */

/** 把已知的底层错误翻译成「照着做就能修」的指引 */
function hintOf(msg: string): string {
  const s = msg.toLowerCase();
  if (s.includes("no such table") || s.includes("does not exist")) {
    return "（数据库缺少数据表：在应用目录执行 `npx prisma db push`，再 `pm2 reload admin`）";
  }
  if (s.includes("did not initialize yet") || s.includes("prisma client")) {
    return "（Prisma 客户端未生成或不匹配：执行 `npx prisma generate` 后重新构建）";
  }
  if (s.includes("unknown argument") || s.includes("unknown field")) {
    return "（Prisma 客户端与 schema.prisma 不一致：重新 `npx prisma generate` 并重建）";
  }
  if (s.includes("unable to open") || s.includes("readonly database")) {
    return "（数据库文件不可读写：检查 SQLite 路径与运行用户权限）";
  }
  return "";
}

export function serverError(e: unknown, label: string) {
  const msg = e instanceof Error ? e.message : String(e);
  // 必须自己打日志：异常被 catch 后不再冒泡到 Next 默认处理器，不打就什么都看不到
  console.error(`[api:${label}] 未捕获异常：`, e);
  return Response.json(
    { error: `服务端处理失败：${msg}${hintOf(msg)}` },
    { status: 500 },
  );
}

/** 包住一个 handler，保证任何异常都以 JSON 形式返回。 */
export async function guarded(label: string, fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    return serverError(e, label);
  }
}
