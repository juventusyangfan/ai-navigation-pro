import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "./db";
import { getSessionPayload } from "./auth";
import { userCan, type AdminWithRole } from "./rbac";

export function ok(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function fail(status: number, message: string, init?: ResponseInit) {
  return NextResponse.json({ error: message }, { status, ...init });
}

/** 读取当前会话并加载带角色的 AdminUser；无会话/禁用返回 null */
export async function loadSessionAdmin(): Promise<AdminWithRole | null> {
  const session = await getSessionPayload();
  if (!session) return null;
  const admin = await db.adminUser.findUnique({
    where: { id: session.sub },
    include: { role: { include: { permissions: true } } },
  });
  if (!admin || admin.status !== "active") return null;
  return admin as AdminWithRole;
}

/**
 * 受保护 API 守卫：校验登录 + RBAC。
 * 返回 { admin } 或 { error: NextResponse }，调用方用 if (guard.error) return guard.error 短路。
 */
export async function requireAdmin(
  resource: string,
  action: string,
): Promise<{ admin?: AdminWithRole; error?: NextResponse }> {
  const admin = await loadSessionAdmin();
  if (!admin) return { error: fail(401, "未登录或会话已失效") };
  if (!userCan(admin, resource, action)) {
    return { error: fail(403, "无权限执行该操作") };
  }
  return { admin };
}

/** 解析 CORS 白名单（NEXT_PUBLIC_SITE_ORIGIN，逗号分隔，自动去除尾部斜杠） */
function allowedOrigins(): string[] {
  return (process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "")
    .split(",")
    .map((s) => s.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

/**
 * 开发环境放行本机来源。
 *
 * 本地预览静态壳时，页面跑在 Live Server 之类的静态服务器上
 * （127.0.0.1:5500、localhost:5173…），**端口不固定、无法穷举进白名单**。
 * 而 loopback 来源只可能出自本机，放行不存在安全风险。
 *
 * 生产环境一律 false —— 线上不接受 loopback 作为可信来源。
 * 注意：`Origin: null`（file:// 打开）**不放行**，沙箱 iframe 同样是 null，
 * 放行会打开越权面；本地预览请用 HTTP 服务器而非双击打开文件。
 */
function isDevLoopback(origin: string): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin);
}

/**
 * 决定本次响应该返回哪个 Access-Control-Allow-Origin。
 * 命中白名单或（开发环境下的）本机来源时回显请求方 origin，否则退回白名单首项。
 */
async function resolveAllowedOrigin(): Promise<string> {
  let reqOrigin = "";
  try { reqOrigin = (await headers()).get("origin") ?? ""; } catch { /* 非请求上下文 */ }
  const list = allowedOrigins();
  if (reqOrigin && (list.includes(reqOrigin) || isDevLoopback(reqOrigin))) return reqOrigin;
  return list[0] ?? "*";
}

/**
 * 公开内容 API 的 CORS 头（白名单由 NEXT_PUBLIC_SITE_ORIGIN 配置，支持逗号分隔多域名）。
 * 必须带 `Vary: Origin`：响应头随请求 Origin 变化，缺了它会被 CDN/反代按 URL 错误缓存，
 * 导致某些来源拿到别的来源的 ACAO 而随机失败。
 */
export async function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": await resolveAllowedOrigin(),
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    Vary: "Origin",
  };
}

/** 公开鉴权 API 的 CORS 头（允许跨域 POST + 预检，白名单同上） */
export async function corsAuth() {
  return {
    "Access-Control-Allow-Origin": await resolveAllowedOrigin(),
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    Vary: "Origin",
  };
}
