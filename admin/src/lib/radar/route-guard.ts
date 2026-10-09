import { fail } from "@/lib/http";

/**
 * 赛事雷达 Route Handler 的统一异常兜底。
 *
 * ── 为什么必须有这一层（真实踩坑，2026-10-09） ──────────────────────────────
 * Next.js 在**生产环境**下，对 Route Handler 的未捕获异常返回的是
 * **HTTP 500 + 空 body**（详细堆栈只写服务端日志，只有 dev 才回显到页面）。
 * 前端拿到空 body 后执行 `res.json()` 就会抛：
 *
 *   Failed to execute 'json' on 'Response': Unexpected end of JSON input
 *
 * 这句报错和真实原因（数据库缺表 / Prisma 客户端未生成 / 任一空指针）**毫无关系**，
 * 而且看起来像前端 bug —— 排查会一路跑偏到前端代码里，我在 13KB 的小文件上传上
 * 就踩了这个坑，白排查了一轮 nginx 体积限制。
 *
 * 结论：**凡是会碰数据库或外部 IO 的接口，出口必须是 JSON**。
 * 宁可返回一句「服务端处理失败：xxx」让人一眼看到根因，也不要返回空 body。
 */

/** 把已知的底层错误翻译成「照着做就能修」的指引 */
function hintOf(msg: string): string {
  const s = msg.toLowerCase();
  if (s.includes("does not exist") || s.includes("no such table")) {
    return "（数据库缺少雷达相关数据表：请在服务器应用目录执行 `npx prisma db push`，再 `pm2 reload admin`）";
  }
  if (s.includes("did not initialize yet") || s.includes("prisma client")) {
    return "（Prisma 客户端未生成或不匹配：请在服务器执行 `npx prisma generate`，再 `pm2 reload admin`）";
  }
  if (s.includes("unknown argument") || s.includes("unknown field") || s.includes("unknown enum")) {
    return "（Prisma 客户端与 schema.prisma 不一致：请重新 `npx prisma generate` 并重建）";
  }
  if (s.includes("unable to open") || s.includes("readonly database")) {
    return "（数据库文件不可读写：请检查 SQLite 文件路径与运行用户权限）";
  }
  return "";
}

/**
 * 记录服务端日志并返回 500 JSON。
 *
 * 注意 log 必须在这里自己打：异常被 catch 后就不再冒泡到 Next 的默认处理器，
 * 不打日志的话 `pm2 logs admin` 里什么都看不到，等于把线索丢了。
 */
export function serverError(e: unknown, label: string) {
  const msg = e instanceof Error ? e.message : String(e);
  console.error(`[radar:${label}] 未捕获异常：`, e);
  return fail(500, `服务端处理失败：${msg}${hintOf(msg)}`);
}

/**
 * 包住一个 handler，保证任何异常都以 JSON 形式返回。
 *
 * 用法（保持导出的 handler 极薄，避免大段重排缩进）：
 *   export async function POST(req: Request) {
 *     return guarded("radar/import", () => handleImport(req));
 *   }
 */
export async function guarded(label: string, fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    return serverError(e, label);
  }
}
