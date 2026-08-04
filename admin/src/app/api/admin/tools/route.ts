import { db } from "@/lib/db";
import { requireAdmin, ok, fail } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireAdmin("tools", "read");
  if (guard.error) return guard.error;
  const tools = await db.tool.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { paths: true } } },
  });
  return ok(
    tools.map((t) => ({
      id: t.id,
      slug: t.slug,
      name: t.name,
      logo: t.logo,
      color: t.color,
      pricing: t.pricing,
      rating: t.rating,
      status: t.status,
      pathCount: t._count.paths,
    })),
  );
}

export async function POST(req: Request) {
  const guard = await requireAdmin("tools", "write");
  if (guard.error) return guard.error;
  const b = await req.json();
  if (!b.slug || !b.name) return fail(400, "slug 与 name 必填");
  const exists = await db.tool.findUnique({ where: { slug: b.slug } });
  if (exists) return fail(409, "slug 已存在");
  const tool = await db.tool.create({
    data: {
      slug: b.slug,
      name: b.name,
      logo: b.logo ?? String(b.name).slice(0, 2),
      color: b.color ?? "#2f6bff",
      tagline: b.tagline ?? "",
      url: b.url ?? "",
      roles: JSON.stringify(b.roles ?? []),
      scenes: JSON.stringify(b.scenes ?? []),
      subjects: JSON.stringify(b.subjects ?? []),
      pricing: b.pricing ?? "Free",
      platform: b.platform ?? "",
      pros: JSON.stringify(b.pros ?? []),
      cons: JSON.stringify(b.cons ?? []),
      alts: JSON.stringify(b.alts ?? []),
      compliance: b.compliance ?? "",
      status: b.status ?? "draft",
      rating: Number(b.rating ?? 0),
    },
  });
  return ok(tool, { status: 201 });
}
