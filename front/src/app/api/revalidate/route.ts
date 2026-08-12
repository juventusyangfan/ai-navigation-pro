import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// 后台保存通识课内容后，fire-and-forget 调用本端点即时刷新 ISR 缓存。
// 调用失败只记日志、不影响保存成功（最坏 1 小时后自然过期）。
export async function POST(req: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) return NextResponse.json({ error: "未配置 REVALIDATE_SECRET" }, { status: 500 });

  let body: { secret?: string; paths?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体无效" }, { status: 400 });
  }
  if (body.secret !== secret) {
    return NextResponse.json({ error: "凭据错误" }, { status: 401 });
  }
  const paths = Array.isArray(body.paths) ? body.paths.slice(0, 50) : [];
  for (const p of paths) {
    if (typeof p === "string" && p.startsWith("/")) {
      try {
        revalidatePath(p);
      } catch {
        // 单条失败不影响其余
      }
    }
  }
  return NextResponse.json({ revalidated: true, paths });
}
