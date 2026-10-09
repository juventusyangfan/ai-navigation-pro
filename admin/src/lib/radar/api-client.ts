/**
 * 赛事雷达后台的浏览器侧响应解析。
 *
 * ── 为什么不直接用 `res.json()`（真实踩坑，2026-10-09） ─────────────────────
 * `await res.json()` 有三个静默陷阱，任何一个踩中，用户看到的都是一句
 * 与真实原因无关的话，或者干脆什么都看不到：
 *
 * 1) **空 body**（服务端未捕获异常 → 生产环境返回 500 空响应）
 *    → `Unexpected end of JSON input`，看着像前端 bug，实际是服务端挂了。
 * 2) **非 JSON body**（nginx 413/502 错误页、登录页 HTML 被跟随重定向）
 *    → `Unexpected token '<'`，同样看不出是谁的问题。
 * 3) **HTTP 错误码 + 合法 JSON**（401/403/409…）
 *    多数调用点写的是 `if (!res.ok) throw new Error(...)`，但顺序写反
 *    （先 json 后判 ok）时，错误信息就丢了。
 *
 * 本模块把这三件事一次性处理掉：先读文本 → 判空 → 判 JSON → 判状态码，
 * 并且按状态码补一句「该怎么办」。
 */

const STATUS_HINT: Record<number, string> = {
  400: "请求内容不合法。",
  401: "登录状态已失效，请重新登录后再操作。",
  403: "当前账号没有赛事雷达的相应权限（读取需 radar:read，编辑需 radar:write，回滚/下架需 radar:delete）。",
  404: "接口不存在。服务端可能仍是旧版本，请确认已重新构建并 `pm2 reload admin`。",
  405: "该接口不允许此操作。",
  409: "存在冲突（例如同一份文件已导入过）。",
  413: "上传内容超过网关体积限制，请检查 nginx 的 `client_max_body_size`。",
  502: "网关无法连接后端应用：请确认 pm2 中 admin 进程正在运行。",
  503: "服务暂时不可用，请稍后重试。",
  504: "网关等待后端超时：服务端可能已卡住，请查看 `pm2 logs admin`。",
};

/** 服务端异常统一落 500；空 body 的 500 几乎一定是未捕获异常 */
const EMPTY_500_HINT =
  "空响应通常意味着服务端发生了未捕获异常（Next.js 生产环境不会把堆栈返给浏览器）。请到服务器执行 `pm2 logs admin --lines 100` 查看真实原因。";

/**
 * 解析 API 响应。
 * @throws 带可读原因与处置建议的 Error（调用方直接 setErr(e.message) 即可）
 */
export async function readApi<T = Record<string, unknown>>(res: Response): Promise<T> {
  const raw = await res.text();
  const status = res.status;
  const statusText = res.statusText ? ` ${res.statusText}` : "";
  const hint = STATUS_HINT[status] ?? "";

  if (!raw.trim()) {
    throw new Error(
      `服务端返回空响应（HTTP ${status}${statusText}）。` + (hint || EMPTY_500_HINT),
    );
  }

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    // 压缩空白后再截断：错误页的 HTML 前若干字符往往全是换行与缩进，直接截会什么都看不到
    const snippet = raw.replace(/\s+/g, " ").trim().slice(0, 180);
    throw new Error(
      `服务端返回的不是 JSON（HTTP ${status}${statusText}）。${hint} 响应片段：${snippet}`,
    );
  }

  const obj = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;

  if (!res.ok) {
    const detail = obj.error ?? obj.message;
    throw new Error(detail ? String(detail) : `请求失败（HTTP ${status}${statusText}）${hint}`);
  }

  return obj as T;
}
