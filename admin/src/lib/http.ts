import { NextResponse } from "next/server";
import { db } from "./db";
import { getSessionPayload } from "./auth";
import { userCan, type AdminWithRole } from "./rbac";

export function ok(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function fail(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
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

/** 公开内容 API 的 CORS 头（白名单由 NEXT_PUBLIC_SITE_ORIGIN 配置） */
export function corsHeaders() {
  const origin = process.env.NEXT_PUBLIC_SITE_ORIGIN;
  return { "Access-Control-Allow-Origin": origin || "*", "Access-Control-Allow-Methods": "GET,OPTIONS" };
}
