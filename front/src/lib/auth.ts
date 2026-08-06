// 前台账号会话：注册 / 登录 / 本地会话读写
// 登录成功后后台返回 JWT（ea_user_session），前端存于 localStorage，后续请求经 authFetch 附带。

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";
const SKEY = "ea_user";

export interface SessionUser {
  id: string;
  name: string;
  phone: string;
  role: string;
  token: string;
  ts: number;
}

export function getSession(): SessionUser | null {
  try {
    const s = localStorage.getItem(SKEY);
    return s ? (JSON.parse(s) as SessionUser) : null;
  } catch {
    return null;
  }
}

export function setSession(u: SessionUser): void {
  localStorage.setItem(SKEY, JSON.stringify(u));
  notifyAuthChange();
}

export function clearSession(): void {
  localStorage.removeItem(SKEY);
  notifyAuthChange();
}

/** 通知常驻 Header 等组件刷新登录态（同标签页内 setSession/clearSession 后） */
function notifyAuthChange(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("ea:auth-change"));
  }
}

export async function register(payload: {
  phone: string;
  name: string;
  role: string;
  password: string;
  confirmPassword: string;
}): Promise<{ ok: boolean; user: { id: string; name: string; phone: string; role: string } }> {
  const r = await fetch(`${API_BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error || "注册失败");
  return data;
}

export async function login(
  phone: string,
  password: string,
): Promise<{ ok: boolean; token: string; user: { id: string; name: string; phone: string; role: string } }> {
  const r = await fetch(`${API_BASE}/api/auth/user-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, password }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error || "登录失败");
  return data;
}

/** 携带会话 token 的请求封装（后台受保护接口用） */
export async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const s = getSession();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string> | undefined),
  };
  if (s?.token) headers["Authorization"] = `Bearer ${s.token}`;
  return fetch(`${API_BASE}${path}`, { ...init, headers });
}
