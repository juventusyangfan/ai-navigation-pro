import { db } from "@/lib/db";
import { requireAdmin, ok, fail } from "@/lib/http";
import { runCollect } from "@/lib/collect/agent";
import { isValidSlug } from "@/lib/collect/contract";

export const dynamic = "force-dynamic";

/**
 * 采集中心 API。
 *  - action: "discover"  → 跑 LLM 采集，返回候选预览（不入库，需人工确认）
 *  - action: "confirm"   → 把勾选的候选以 draft 入库（跳过已存在的 slug，避免覆盖 curated）
 * 鉴权复用现有 RBAC：discover 需 tools:read，confirm 需 tools:write。
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const action = body.action === "confirm" ? "confirm" : "discover";

  if (action === "discover") {
    const guard = await requireAdmin("tools", "read");
    if (guard.error) return guard.error;
    try {
      const proposals = await runCollect({
        query: String(body.query || ""),
        count: Number(body.count || 10),
        sceneFilter: body.sceneFilter ? String(body.sceneFilter) : undefined,
      });

      // 过滤数据库中已存在的产品（slug 去重，避免展示已入库候选）
      const slugs = proposals.map((p) => p.slug).filter(Boolean);
      const existing = slugs.length
        ? await db.tool.findMany({ where: { slug: { in: slugs } }, select: { slug: true } })
        : [];
      const existingSlugs = new Set(existing.map((e) => e.slug));
      const filtered = proposals.filter((p) => !existingSlugs.has(p.slug));

      return ok({ proposals: filtered, excluded: existingSlugs.size });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "采集失败";
      return fail(502, msg);
    }
  }

  // confirm
  const guard = await requireAdmin("tools", "write");
  if (guard.error) return guard.error;

  const list = Array.isArray(body.proposals) ? body.proposals : [];
  let upserted = 0;
  const rejected: string[] = [];

  for (const p of list) {
    const slug = String(p?.slug || "").toLowerCase().trim();
    const name = String(p?.name || "").trim();
    const url = String(p?.url || "").trim();
    const scenes = Array.isArray(p?.scenes) ? (p.scenes as string[]) : [];

    if (!isValidSlug(slug) || !name || !url || scenes.length === 0) {
      rejected.push(slug || name || "?（字段不完整）");
      continue;
    }

    const exist = await db.tool.findUnique({ where: { slug } });
    if (exist) {
      rejected.push(`${slug}（已存在，跳过）`);
      continue;
    }

    await db.tool.create({
      data: {
        slug,
        name,
        logo: String(p?.logo || name).slice(0, 2),
        color: String(p?.color || "#2f6bff"),
        tagline: String(p?.tagline || ""),
        url,
        roles: JSON.stringify(p?.roles ?? []),
        scenes: JSON.stringify(scenes),
        subjects: JSON.stringify(p?.subjects ?? ["综合"]),
        pricing: String(p?.pricing || "Freemium"),
        platform: String(p?.platform || ""),
        pros: JSON.stringify(p?.pros ?? []),
        cons: JSON.stringify(p?.cons ?? []),
        alts: JSON.stringify(p?.alts ?? []),
        compliance: String(p?.compliance || ""),
        rating: 0,
        status: "draft",
      },
    });
    upserted++;
  }

  return ok({ upserted, rejected });
}
