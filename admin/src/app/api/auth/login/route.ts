import { db } from "@/lib/db";
import { verifyPassword, createSession } from "@/lib/auth";
import { ok, fail } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { email, password } = await req.json();
  if (!email || !password) return fail(400, "邮箱与密码必填");
  const admin = await db.adminUser.findUnique({
    where: { email },
    include: { role: true },
  });
  if (!admin || admin.status !== "active") return fail(401, "账号不存在或已禁用");
  const okPwd = await verifyPassword(password, admin.passwordHash);
  if (!okPwd) return fail(401, "密码错误");
  await createSession({ sub: admin.id, email: admin.email, role: admin.role.key });
  return ok({ ok: true, name: admin.name, role: admin.role.key });
}
