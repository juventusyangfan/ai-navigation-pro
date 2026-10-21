/**
 * 浏览器侧读 JSON 的安全封装。
 *
 * 不要直接 `await res.json()`：服务端 500 且 body 为空时，抛的是
 * "Unexpected end of JSON input"，看起来像前端 bug，实际是服务端异常。
 * 这里把三种情况分开报：空 body / 非 JSON / 业务错误，页面上直接能看出是哪种。
 */

export async function readApi<T = any>(res: Response): Promise<T> {
  const raw = await res.text();
  if (!raw.trim()) {
    throw new Error(`服务端返回空响应（HTTP ${res.status}），请查看 admin 日志`);
  }
  let data: any;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(`服务端返回了非 JSON 内容（HTTP ${res.status}），通常是网关错误页`);
  }
  if (!res.ok) {
    const msg = data?.error || `请求失败（HTTP ${res.status}）`;
    const hint = data?.hint ? ` ${data.hint}` : "";
    throw new Error(msg + hint);
  }
  return data as T;
}
