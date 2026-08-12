import type { LitLinkStatus } from "../serialize";

export interface LinkCheckResult {
  status: LitLinkStatus;
  httpCode?: number;
  finalUrl?: string;
}

/**
 * 外链探活：对国家平台课程 URL 发请求，跟随重定向。
 * - 2xx            -> ok
 * - 3xx / 4xx / 5xx -> warn（落点或状态异常，但不直接判死）
 * - 网络错误/超时   -> broken（配合 linkFailCount 抖动容错，连续失败才下定论）
 *
 * 注：国家平台可能对服务端 UA / 数据中心 IP 做风控，探活结果仅供参考，
 * 人工可在后台覆盖 linkStatus。
 */
export async function probeLink(
  url: string,
  timeoutMs = 8000,
): Promise<LinkCheckResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const headers = {
    "User-Agent":
      "Mozilla/5.0 (compatible; eanavi-linkcheck/1.0; +https://eanavi.com)",
    Accept: "text/html,*/*",
  };

  const tryFetch = async (method: "HEAD" | "GET") => {
    try {
      const res = await fetch(url, {
        method,
        redirect: "follow",
        signal: controller.signal,
        headers,
      });
      return res;
    } catch {
      return null;
    }
  };

  try {
    let res = await tryFetch("HEAD");
    // 部分站点不支持 HEAD 或返回 4xx/5xx，回退 GET
    if (!res || res.status >= 400) {
      res = await tryFetch("GET");
    }
    clearTimeout(timer);
    if (!res) return { status: "broken" };
    const code = res.status;
    if (code >= 200 && code < 300) return { status: "ok", httpCode: code, finalUrl: res.url };
    return { status: "warn", httpCode: code, finalUrl: res.url };
  } catch {
    clearTimeout(timer);
    return { status: "broken" };
  }
}
