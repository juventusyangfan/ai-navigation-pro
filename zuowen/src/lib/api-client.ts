// 浏览器侧取数封装
//
// 沿用 admin 项目的教训：不要无条件 res.json()。服务端异常时可能返回空 body，
// 直接 json() 会抛 "Unexpected end of JSON input"，这句报错与真实原因毫无关系。
// 这里统一读文本 → 判空 → 判 JSON → 判状态码，最后给出人话错误。

export type ApiResult<T> = { ok: true; data: T } | { ok: false; message: string; code?: string };

export async function postJson<T>(url: string, body: unknown): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, message: "网络不太稳定，请检查网络后再试一次" };
  }
  return read<T>(res);
}

export async function getJson<T>(url: string): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store" });
  } catch {
    return { ok: false, message: "网络不太稳定，请稍后再试" };
  }
  return read<T>(res);
}

async function read<T>(res: Response): Promise<ApiResult<T>> {
  const text = await res.text();
  if (!text.trim()) {
    return {
      ok: false,
      message:
        res.status >= 500
          ? "服务端出了点状况，请稍后再试（若持续出现，请联系我们）"
          : "没有拿到响应内容，请稍后再试",
    };
  }
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, message: "服务端返回的内容无法识别，请稍后再试" };
  }
  if (!res.ok || data?.ok === false) {
    return {
      ok: false,
      message: typeof data?.error === "string" ? data.error : `请求失败（${res.status}）`,
      code: typeof data?.code === "string" ? data.code : undefined,
    };
  }
  return { ok: true, data: data as T };
}
