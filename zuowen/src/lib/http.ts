// 统一 JSON 出口
//
// 沿用 admin 项目踩坑后的做法：Next.js 生产环境下 Route Handler 抛出未捕获异常时，
// 返回的是 HTTP 500 + **空 body**，前端 res.json() 会报
// "Unexpected end of JSON input"，这句报错和真实原因毫无关系，排查会被带偏。
// 所以凡是碰数据库或外部 IO 的接口，出口必须是 JSON，宁可回一句人话。

export function ok(data: unknown, init?: ResponseInit): Response {
  return Response.json(data, { status: 200, ...init });
}

export function fail(status: number, message: string, extra?: Record<string, unknown>): Response {
  return Response.json({ ok: false, error: message, ...extra }, { status });
}

function hintOf(msg: string): string {
  const s = msg.toLowerCase();
  if (s.includes("does not exist") || s.includes("no such table")) {
    return "（数据库缺少数据表：请在应用目录执行 `npx prisma db push`，再重启 zuowen）";
  }
  if (s.includes("zw_text_key")) {
    return "（缺少 ZW_TEXT_KEY：请生成 32 字节密钥写入 .env，命令见 README）";
  }
  if (s.includes("unable to open") || s.includes("readonly database")) {
    return "（数据库文件不可读写：请检查 SQLite 路径与运行用户权限）";
  }
  return "";
}

export function serverError(e: unknown, label: string): Response {
  const msg = e instanceof Error ? e.message : String(e);
  console.error(`[zuowen:${label}] 未捕获异常：`, e);
  return fail(500, `服务端处理失败：${msg}${hintOf(msg)}`);
}

/** 包住 handler，保证任何异常都以 JSON 返回。 */
export async function guarded(label: string, fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    return serverError(e, label);
  }
}
