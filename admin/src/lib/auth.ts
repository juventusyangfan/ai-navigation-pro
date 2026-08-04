// Node 运行时鉴权：bcrypt 密码 + httpOnly Cookie 会话
// 注意：middleware 只能 import jwt.ts（edge 安全），不能 import 本文件（bcrypt 是 node-only）。
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { signSession, verifySession, type SessionPayload } from "./jwt";

export const SESSION_COOKIE = "ea_admin_session";

export function hashPassword(p: string): Promise<string> {
  return bcrypt.hash(p, 10);
}

export function verifyPassword(p: string, hash: string): Promise<boolean> {
  return bcrypt.compare(p, hash);
}

export async function createSession(payload: SessionPayload): Promise<void> {
  const token = await signSession(payload);
  const c = await cookies();
  c.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function destroySession(): Promise<void> {
  const c = await cookies();
  c.delete(SESSION_COOKIE);
}

export async function getSessionPayload(): Promise<SessionPayload | null> {
  const c = await cookies();
  const token = c.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}
