// 前台注册用户态解析：从 Authorization: Bearer <JWT> 还原端用户。
// 该 JWT 由 api/auth/user-login 经 jwt.signSession 签发（payload.sub = user.id）。
import { verifySession } from "@/lib/jwt";
import { db } from "@/lib/db";

export interface MeUser {
  id: string;
  role: string;
  phone: string | null;
}

/** 从请求头解析当前端用户；无 token / 失效 / 禁用 均返回 null */
export async function getMe(req: Request): Promise<MeUser | null> {
  const auth = req.headers.get("authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/);
  if (!m) return null;
  const payload = await verifySession(m[1]);
  if (!payload?.sub) return null;
  const user = await db.user.findUnique({ where: { id: payload.sub } });
  if (!user || user.status !== "active") return null;
  return { id: user.id, role: user.role, phone: user.phone };
}
