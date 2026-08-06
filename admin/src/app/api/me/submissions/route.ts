import { db } from "@/lib/db";
import { ok, fail } from "@/lib/http";

export const dynamic = "force-dynamic";

// 公开站暂无独立账号体系（前台登录为本地模拟），投稿以单例游客用户落库，
// 既满足 Submission.userId 必填外键，又避免为每次投稿污染 User 表。
const GUEST_EMAIL = "guest-submission@system.local";

// 投稿为跨域 POST（前台 :3000 → 后台 :3001），需显式放行 POST 与 Content-Type，
// 否则浏览器预检（OPTIONS）会被拒。
function corsHeaders(): Record<string, string> {
  const origin = process.env.NEXT_PUBLIC_SITE_ORIGIN || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

async function ensureGuestUser() {
  let u = await db.user.findUnique({ where: { email: GUEST_EMAIL } });
  if (!u) {
    u = await db.user.create({
      data: { email: GUEST_EMAIL, name: "投稿游客", role: "teacher", passwordHash: null },
    });
  }
  return u;
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail(400, "请求体格式错误");
  }
  const b = body as { payload?: { tool?: { name?: string; url?: string } } };
  const tool = b?.payload?.tool;
  if (!tool || !tool.name?.trim() || !tool.url?.trim()) {
    return fail(400, "缺少工具名称或官网链接");
  }
  if (!/^https?:\/\//i.test(tool.url)) {
    return fail(400, "官网链接必须以 http(s):// 开头");
  }

  const guest = await ensureGuestUser();
  const submission = await db.submission.create({
    data: {
      type: "tool",
      payload: JSON.stringify((b as { payload?: unknown })?.payload ?? {}),
      userId: guest.id,
      status: "pending",
    },
  });

  return ok(
    { id: submission.id, status: submission.status },
    { headers: corsHeaders() },
  );
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function GET() {
  return fail(501, "公开站用户互动 API 计划于 Phase 3 落地");
}
