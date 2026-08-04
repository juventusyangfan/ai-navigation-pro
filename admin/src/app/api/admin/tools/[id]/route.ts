import { db } from "@/lib/db";
import { requireAdmin, ok, fail } from "@/lib/http";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const guard = await requireAdmin("tools", "read");
  if (guard.error) return guard.error;
  const { id } = await params;
  const tool = await db.tool.findUnique({
    where: { id },
    include: { paths: { include: { steps: true }, orderBy: { order: "asc" } } },
  });
  if (!tool) return fail(404, "工具不存在");
  return ok(tool);
}

export async function PUT(req: Request, { params }: Ctx) {
  const guard = await requireAdmin("tools", "write");
  if (guard.error) return guard.error;
  const { id } = await params;
  const b = await req.json();
  const tool = await db.tool.findUnique({ where: { id } });
  if (!tool) return fail(404, "工具不存在");
  if (b.slug && b.slug !== tool.slug) {
    const clash = await db.tool.findUnique({ where: { slug: b.slug } });
    if (clash) return fail(409, "slug 已存在");
  }
  const updated = await db.tool.update({
    where: { id },
    data: {
      slug: b.slug ?? tool.slug,
      name: b.name ?? tool.name,
      logo: b.logo ?? tool.logo,
      color: b.color ?? tool.color,
      tagline: b.tagline ?? tool.tagline,
      url: b.url ?? tool.url,
      roles: b.roles ? JSON.stringify(b.roles) : tool.roles,
      scenes: b.scenes ? JSON.stringify(b.scenes) : tool.scenes,
      subjects: b.subjects ? JSON.stringify(b.subjects) : tool.subjects,
      pricing: b.pricing ?? tool.pricing,
      platform: b.platform ?? tool.platform,
      pros: b.pros ? JSON.stringify(b.pros) : tool.pros,
      cons: b.cons ? JSON.stringify(b.cons) : tool.cons,
      alts: b.alts ? JSON.stringify(b.alts) : tool.alts,
      compliance: b.compliance ?? tool.compliance,
      status: b.status ?? tool.status,
      rating: b.rating != null ? Number(b.rating) : tool.rating,
    },
  });
  return ok(updated);
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const guard = await requireAdmin("tools", "delete");
  if (guard.error) return guard.error;
  const { id } = await params;
  const tool = await db.tool.findUnique({ where: { id } });
  if (!tool) return fail(404, "工具不存在");
  await db.tool.delete({ where: { id } });
  return ok({ ok: true });
}
