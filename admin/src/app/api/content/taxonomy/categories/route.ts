import { db } from "@/lib/db";
import { ok, corsHeaders } from "@/lib/http";

export const dynamic = "force-dynamic";

// 分类法（Category）→ 前端 CATS 形状：{ [key]: { icon, phase, desc } }
// 注意：前端 Cat 不含 name/order，此处仅返回 icon/phase/desc，保持与静态 CATS 完全一致。
export async function GET() {
  const cats = await db.category.findMany({ orderBy: { order: "asc" } });
  const map: Record<string, { icon: string; phase: string; desc: string }> = {};
  for (const c of cats) {
    map[c.key] = { icon: c.icon, phase: c.phase, desc: c.desc };
  }
  return ok(map, { headers: corsHeaders() });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
