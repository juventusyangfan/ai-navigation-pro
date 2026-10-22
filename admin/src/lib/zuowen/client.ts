/**
 * admin → zuowen（作文测评）服务端到服务端客户端。
 *
 * ── 为什么走 HTTP，而不是直接读 zuowen 的 SQLite ─────────────────────────────
 * 1. **密钥只留在一处**。孩子作文正文是 AES-256-GCM 密文，解密密钥在 zuowen 的 .env。
 *    admin 不持有这个能力 —— 哪天后台被人拿了，拿到的也只是密文。
 * 2. 两个应用各自一个库，跨库直读会让 schema 变更互相绊住，也会让「删表」这种
 *    危险操作的影响面从 1 个应用扩大到 2 个。
 * 代价是多一跳本地回环请求（实测 < 5ms），完全值得。
 *
 * ── 错误处理 ────────────────────────────────────────────────────────────────
 * 一律返回结构化结果而不是 throw：调用方要决定「是给用户看提示」还是「返回 503」。
 * 并且**先读 text 再 parse**：Next 生产环境未捕获异常是 500 + 空 body，
 * 直接 res.json() 会抛一句与真实原因无关的错。
 */

export type ZuowenFail = {
  ok: false;
  /** HTTP 状态；本地未配置时给 503，前端据此显示配置指引而不是「加载失败」 */
  status: number;
  error: string;
  hint?: string;
};

export type ZuowenOk<T> = { ok: true; data: T };

export type ZuowenResult<T> = ZuowenOk<T> | ZuowenFail;

function baseUrl(): string {
  return (process.env.ZUOWEN_BASE_URL || "").trim().replace(/\/+$/, "");
}

function token(): string {
  return (process.env.ZUOWEN_CRON_TOKEN || "").trim();
}

/** 是否配齐了访问作文测评服务需要的两项配置。 */
export function zuowenConfigured(): boolean {
  return Boolean(baseUrl() && token());
}

/** 未配置时给运维看的一句话（要能照着做）。 */
export function zuowenConfigHint(): string {
  const miss: string[] = [];
  if (!baseUrl()) miss.push("ZUOWEN_BASE_URL（如 http://127.0.0.1:3002）");
  if (!token()) miss.push("ZUOWEN_CRON_TOKEN（须与 zuowen 的 ZW_CRON_TOKEN 一致）");
  return `后台未配置作文测评服务：请在 admin 的 .env 里补 ${miss.join("、")}，然后 pm2 reload admin --update-env`;
}

/** 家长拿到的报告页地址（详情页「复制链接」用）。 */
export function zuowenPublicBase(): string {
  return (process.env.ZUOWEN_PUBLIC_BASE || "https://zuowen.eanavi.com").trim().replace(/\/+$/, "");
}

function hintForStatus(status: number): string {
  if (status === 401) {
    return "（zuowen 拒绝了 token：admin 的 ZUOWEN_CRON_TOKEN 必须与 zuowen 的 ZW_CRON_TOKEN 完全一致；zuowen 侧未配置时为关闭状态）";
  }
  if (status === 404) {
    return "（接口不存在：zuowen 可能是旧版本，未包含 /api/internal/reviews，请确认已 git pull 并重新构建）";
  }
  if (status === 503) {
    return "（zuowen 尚未配置模型 Key 或正文密钥，见 zuowen/.env）";
  }
  if (status >= 500) {
    return "（查看服务器 logs/zuowen-err.log）";
  }
  return "";
}

type Query = Record<string, string | number | undefined>;

/**
 * 内部请求的公共实现（GET / PATCH 共用一套解析顺序）。
 * @param path 以 / 开头，例如 "/api/internal/reviews"
 */
async function zuowenRequest<T>(
  method: "GET" | "PATCH",
  path: string,
  params: Query = {},
  body?: unknown,
  opts: { timeoutMs?: number } = {},
): Promise<ZuowenResult<T>> {
  const base = baseUrl();
  if (!base) return { ok: false, status: 503, error: "未配置作文测评服务地址", hint: zuowenConfigHint() };
  if (!token()) return { ok: false, status: 503, error: "未配置作文测评服务凭证", hint: zuowenConfigHint() };

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
        error: `作文测评服务返回空响应（HTTP ${res.status}）`,
        hint: "（zuowen 进程可能异常：pm2 status zuowen，再看 logs/zuowen-err.log）",
      };
    }

    let data: any;
    try {
      data = JSON.parse(raw);
    } catch {
      return {
        ok: false,
        status: 502,
        error: "作文测评服务返回了非 JSON 内容",
        hint: "（通常是网关错误页：检查 ZUOWEN_BASE_URL 是否指向 zuowen 的 3002 端口）",
      };
    }

    if (!res.ok || data?.ok === false) {
      return {
        ok: false,
        status: res.status || 502,
        error: data?.error || `HTTP ${res.status}`,
        hint: hintForStatus(res.status),
      };
    }

    return { ok: true, data: data as T };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const aborted = /abort/i.test(msg);
    return {
      ok: false,
      status: 504,
      error: aborted ? `作文测评服务响应超时（>${timeoutMs}ms）` : `无法连接作文测评服务：${msg}`,
      hint: aborted
        ? "（统计聚合在数据量大时会变慢：可先不带 stats 重试，并检查 zuowen 负载）"
        : "（确认 zuowen 已启动、ZUOWEN_BASE_URL 的端口正确；同机部署应为 http://127.0.0.1:3002）",
    };
  } finally {
    clearTimeout(timer);
  }
}

/** 发起一次内部 GET。 */
export async function zuowenGet<T>(
  path: string,
  params: Query = {},
  opts: { timeoutMs?: number } = {},
): Promise<ZuowenResult<T>> {
  return zuowenRequest<T>("GET", path, params, undefined, opts);
}

/**
 * 发起一次内部 PATCH（后台改设备额度用）。
 *
 * 写操作不走 GET 的原因不只是语义：zuowen 的内部接口对非 GET 方法没有额外防护，
 * 但把「改额度」做成 PATCH 至少能避免一次误点浏览器地址栏就把家长次数清空。
 */
export async function zuowenPatch<T>(
  path: string,
  body: unknown,
  opts: { timeoutMs?: number } = {},
): Promise<ZuowenResult<T>> {
  return zuowenRequest<T>("PATCH", path, {}, body, opts);
}

/* ------------------------------------------------------------------ *
 * 数据结构（与 zuowen /api/internal/reviews 的返回对齐）
 * ------------------------------------------------------------------ */

export type EssayDim = { content: number; structure: number; language: number; norm: number };

export type EssayListItem = {
  id: string;
  createdAt: string;
  grade: number;
  gradeLabel: string;
  title: string | null;
  genre: string | null;
  charCount: number;
  source: "text" | "image";
  total: number;
  level: string;
  model: string;
  summary: string;
  dims: EssayDim;
};

export type EssayStats = {
  total: number;
  today: number;
  last7: number;
  avgScore: number | null;
  byGrade: { grade: number; label: string; count: number; avg: number | null }[];
  byLevel: { level: string; count: number }[];
  bySource: { source: string; count: number }[];
  dimLabel: Record<keyof EssayDim, string>;
};

export type EssayListPayload = {
  ok: true;
  count: number;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  items: EssayListItem[];
  stats?: EssayStats;
};

export type EssayReport = {
  total: number;
  dims: EssayDim;
  level: string;
  genre: string | null;
  summary: string;
  highlights: { quote: string; why: string }[];
  advice: { issue: string; how: string }[];
  nextStep: string;
  charCount: number;
  span: [number, number];
  flags?: string[];
};

export type EssayDetailItem = EssayListItem & {
  span: [number, number];
  readable: boolean;
  anonId: string;
  /** 设备可读识别码（没被后台分配过时为 null），据此跳到「设备额度」改次数 */
  deviceCode?: string | null;
  deviceCodeDisplay?: string | null;
  deviceLimit?: { limitEnabled: boolean; customLimit: number | null } | null;
  dimMax: EssayDim;
  dimLabel: Record<keyof EssayDim, string>;
  report: EssayReport | null;
  /** 仅在 ?text=1 时返回（解密后的正文） */
  text?: string;
};

export type EssayDetailPayload = { ok: true; item: EssayDetailItem };

/* ------------------------------------------------------------------ *
 * 设备额度（2026-10-22）
 *
 * 一台「设备」= 一个匿名 Cookie。老板给家长放开次数，实际改的是这台设备的额度：
 * 家长页脚念出识别码 → 后台按码搜索 → 开关或填次数。
 * ------------------------------------------------------------------ */

export type DeviceMode = "default" | "custom" | "unlimited";

export type DeviceItem = {
  code: string;
  /** 带横杠的展示形式，如 NUS-7QD */
  display: string;
  note: string | null;
  limitEnabled: boolean;
  customLimit: number | null;
  mode: DeviceMode;
  today: number;
  total: number;
  lastAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DeviceListPayload = {
  ok: true;
  count: number;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  /** 本次顺带补齐识别码的历史设备数量（仅在 sync=1 时可能非 0） */
  synced: number;
  items: DeviceItem[];
  defaults: { dailyLimit: number; globalCap: number; globalUsed: number };
};

export type DeviceUpdatePayload = { ok: true; item: DeviceItem };
