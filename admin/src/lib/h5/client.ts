/**
 * admin → H5（英语听说测评）服务端到服务端客户端。
 *
 * ── 为什么不直接读 H5 的 server/.data/quota.json ───────────────────────────
 * 1. 那是 H5 进程的**内部状态文件**，写入是「整体重新序列化 + 原子 rename」。外部进程
 *    读到的是某一瞬间的完整快照没错，但谁在写、写到哪一步只有 H5 自己知道；哪天改成
 *    SQLite 或加锁，后台就得跟着改。
 * 2. 额度语义在 H5 那边有一份权威实现（`planFor`：unlimited / custom / default 三态 +
 *    个人上限与全站硬顶的关系）。后台再实现一遍，两边的「剩余次数」迟早对不上，
 *    出现「后台显示已放开、家长仍被拦」这种最难查的问题。
 *
 * 代价是多一跳本地回环（实测 < 5ms），换来的是只有一处真相。
 *
 * ── 错误处理 ──────────────────────────────────────────────────────────────
 * 一律返回结构化结果而不是 throw：调用方要决定「给用户看提示」还是「返回 503」。
 * 并且先读 text 再 parse —— 反向代理或进程崩溃时常返回空 body，
 * 直接 res.json() 会抛一句和真实原因无关的错。
 */

export type H5Fail = { ok: false; status: number; error: string; hint?: string };
export type H5Ok<T> = { ok: true; data: T };
export type H5Result<T> = H5Ok<T> | H5Fail;

function baseUrl(): string {
  return (process.env.H5_BASE_URL || "http://127.0.0.1:8787").trim().replace(/\/+$/, "");
}

function token(): string {
  return (process.env.H5_INTERNAL_TOKEN || "").trim();
}

/** H5 内部接口是「未配置 token 就整体关闭」的，所以必须先判空再请求。 */
export function h5Configured(): boolean {
  return Boolean(baseUrl() && token());
}

export function h5ConfigHint(): string {
  const miss: string[] = [];
  if (!baseUrl()) miss.push("H5_BASE_URL（如 http://127.0.0.1:8787）");
  if (!token()) miss.push("H5_INTERNAL_TOKEN（须与 H5 server/.env 的 H5_INTERNAL_TOKEN 一致）");
  return `后台未配置英语测评服务：请在 admin 的 .env 里补 ${miss.join("、")}，然后 pm2 reload admin --update-env`;
}

/** 家长端识别码在本页面上的落地域名，仅用于文案。 */
export function h5PublicBase(): string {
  return (process.env.H5_PUBLIC_BASE || "https://h5.eanavi.com").trim().replace(/\/+$/, "");
}

function hintForStatus(status: number, body?: any): string {
  if (status === 401) {
    return "（H5 拒绝了 token：admin 的 H5_INTERNAL_TOKEN 必须与 H5 server/.env 的完全一致；H5 侧未配置时为关闭状态）";
  }
  if (status === 404) {
    return "（接口或识别码不存在：404 多半是这 6 位码没有对应设备，让家长核对后重试）";
  }
  if (status === 400) {
    return body?.message ? `（${body.message}）` : "";
  }
  if (status >= 500) {
    return "（查看 H5 的 pm2 日志：pm2 logs h5-server）";
  }
  return "";
}

/**
 * 内部请求的公共实现。
 * @param path 以 / 开头，例如 "/api/internal/quota/devices"
 */
async function h5Request<T>(
  method: "GET" | "PATCH",
  path: string,
  params: Record<string, string | number | undefined> = {},
  body?: unknown,
  opts: { timeoutMs?: number } = {},
): Promise<H5Result<T>> {
  const base = baseUrl();
  if (!base) return { ok: false, status: 503, error: "未配置英语测评服务地址", hint: h5ConfigHint() };
  if (!token()) return { ok: false, status: 503, error: "未配置英语测评服务凭证", hint: h5ConfigHint() };

  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    qs.set(k, String(v));
  }
  const url = `${base}${path}${qs.toString() ? `?${qs.toString()}` : ""}`;

  const timeoutMs = opts.timeoutMs ?? 8000;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method,
      headers: {
        "x-cron-token": token(),
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctrl.signal,
      cache: "no-store",
    });

    const raw = await res.text();
    if (!raw.trim()) {
      return {
        ok: false,
        status: 502,
        error: `英语测评服务返回空响应（HTTP ${res.status}）`,
        hint: "（H5 进程可能异常：pm2 status h5-server，再看 pm2 logs h5-server）",
      };
    }

    let data: any;
    try {
      data = JSON.parse(raw);
    } catch {
      return {
        ok: false,
        status: 502,
        error: "英语测评服务返回了非 JSON 内容",
        hint: "（通常是网关错误页：检查 H5_BASE_URL 是否指向 H5 后端的 8787 端口，而不是静态站的 80/443）",
      };
    }

    if (!res.ok || data?.ok === false) {
      return {
        ok: false,
        status: res.status || 502,
        error: data?.message || data?.error || `HTTP ${res.status}`,
        hint: hintForStatus(res.status, data),
      };
    }

    return { ok: true, data: data as T };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const aborted = /abort/i.test(msg);
    return {
      ok: false,
      status: 504,
      error: aborted ? `英语测评服务响应超时（>${timeoutMs}ms）` : `无法连接英语测评服务：${msg}`,
      hint: aborted
        ? "（H5 后端在批量遍历设备时会变慢：先缩小搜索范围再试）"
        : "（确认 h5-server 已启动、H5_BASE_URL 的端口正确；同机部署应为 http://127.0.0.1:8787）",
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function h5Get<T>(
  path: string,
  params: Record<string, string | number | undefined> = {},
  opts: { timeoutMs?: number } = {},
): Promise<H5Result<T>> {
  return h5Request<T>("GET", path, params, undefined, opts);
}

export async function h5Patch<T>(
  path: string,
  body: unknown,
  opts: { timeoutMs?: number } = {},
): Promise<H5Result<T>> {
  return h5Request<T>("PATCH", path, {}, body, opts);
}

/* ------------------------------------------------------------------ *
 * 数据结构
 *
 * H5 侧的时间字段是**毫秒数**（它没有 ORM），admin 侧统一转成 ISO 字符串，
 * 页面格式化函数才能和「设备额度」页共用一套写法。
 * ------------------------------------------------------------------ */

export type SpeakingMode = "default" | "custom" | "unlimited";

export type SpeakingDeviceRaw = {
  code: string;
  codeRaw: string;
  note: string;
  limitMode: SpeakingMode;
  customLimit: number | null;
  limit: number | null;
  unlimited: boolean;
  today: number;
  total: number;
  createdAt: number;
  lastAt: number;
};

export type SpeakingDevice = {
  /** 展示形式 ABC-DEF，同时作为后台的唯一键（PATCH 路径用它） */
  code: string;
  codeRaw: string;
  note: string;
  mode: SpeakingMode;
  customLimit: number | null;
  /** 实际生效的每日次数；不限次数时为 null */
  limit: number | null;
  today: number;
  total: number;
  createdAt: string;
  lastAt: string | null;
};

export type SpeakingDefaults = { dailyLimit: number; totalCap: number; enforce: boolean };

export type SpeakingListRaw = {
  ok: boolean;
  total: number;
  page: number;
  pageSize: number;
  items: SpeakingDeviceRaw[];
  defaults: SpeakingDefaults;
  today: { total: number; distinctDevices: number };
};

export type SpeakingListPayload = {
  ok: true;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  items: SpeakingDevice[];
  defaults: SpeakingDefaults;
  /** 今日全站用量与去重设备数（运营视角：离硬顶还有多远） */
  today: { total: number; distinctDevices: number };
};

export type SpeakingUpdateRaw = {
  ok: boolean;
  device: SpeakingDeviceRaw;
  defaults: { dailyLimit: number; totalCap: number };
};

export type SpeakingUpdatePayload = { ok: true; item: SpeakingDevice };

function toIso(ms: number | null | undefined): string | null {
  if (!ms || !Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

export function normalizeDevice(raw: SpeakingDeviceRaw): SpeakingDevice {
  return {
    code: raw.code,
    codeRaw: raw.codeRaw,
    note: raw.note || "",
    mode: raw.limitMode || "default",
    customLimit: raw.customLimit ?? null,
    limit: raw.limit ?? null,
    today: raw.today || 0,
    total: raw.total || 0,
    createdAt: toIso(raw.createdAt) || new Date(0).toISOString(),
    lastAt: toIso(raw.lastAt),
  };
}

/** 识别码归一化：去掉横杠/空格并转大写，H5 的 normalizeCode 也会做一次，这里只是提前拦住明显错的输入。 */
export function normalizeCodeInput(code: string): string {
  return String(code || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}
