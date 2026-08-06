import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { ok, fail, corsAuth } from "@/lib/http";

export const dynamic = "force-dynamic";

const PHONE_RE = /^1[3-9]\d{9}$/; // 中国大陆手机号
const ROLES = ["teacher", "student", "parent", "school_admin"];

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
  const name = String(body?.name ?? "").trim();
  const role = String(body?.role ?? "");
  const password = String(body?.password ?? "");
  const confirmPassword = String(body?.confirmPassword ?? "");

  if (!PHONE_RE.test(phone))
    return fail(400, "手机号格式不正确（需为 11 位中国大陆手机号）", { headers: corsAuth() });
  if (!name) return fail(400, "请填写真实姓名", { headers: corsAuth() });
  if (!ROLES.includes(role))
    return fail(400, "请选择有效的入驻角色", { headers: corsAuth() });
  if (password.length < 6) return fail(400, "登录密码至少 6 位", { headers: corsAuth() });
  if (password !== confirmPassword)
    return fail(400, "两次输入的密码不一致", { headers: corsAuth() });

  const exist = await db.user.findUnique({ where: { phone } });
  if (exist) return fail(409, "该手机号已注册，请直接登录", { headers: corsAuth() });

  const passwordHash = await hashPassword(password);
  const user = await db.user.create({
    data: { phone, name, role, passwordHash, status: "active" },
  });

  return ok(
    {
      ok: true,
      user: { id: user.id, name: user.name, phone: user.phone, role: user.role },
    },
    { headers: corsAuth() },
  );
}
