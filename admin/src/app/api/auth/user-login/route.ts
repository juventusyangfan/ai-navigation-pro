import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth";
import { signSession } from "@/lib/jwt";
import { ok, fail, corsAuth } from "@/lib/http";

export const dynamic = "force-dynamic";

const PHONE_RE = /^1[3-9]\d{9}$/; // 中国大陆手机号

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsAuth() });
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail(400, "请求体格式错误", { headers: corsAuth() });
  }

  const phone = String(body?.phone ?? "").trim();
  const password = String(body?.password ?? "");

  if (!PHONE_RE.test(phone))
    return fail(400, "手机号格式不正确", { headers: corsAuth() });
  if (!password) return fail(400, "请输入密码", { headers: corsAuth() });

  const user = await db.user.findUnique({ where: { phone } });
  if (!user || user.status !== "active")
    return fail(401, "账号不存在或已禁用", { headers: corsAuth() });
  if (!user.passwordHash) return fail(401, "该账号未设置密码", { headers: corsAuth() });

  const okPwd = await verifyPassword(password, user.passwordHash);
  if (!okPwd) return fail(401, "密码错误", { headers: corsAuth() });

  const token = await signSession({
    sub: user.id,
    email: user.phone ?? "",
    role: user.role,
  });

  return ok(
    {
      ok: true,
      token,
      user: { id: user.id, name: user.name, phone: user.phone, role: user.role },
    },
    { headers: corsAuth() },
  );
}
