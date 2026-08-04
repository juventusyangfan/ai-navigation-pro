import { db } from "@/lib/db";
import { requireAdmin, ok, fail } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireAdmin("sops", "read");
  if (guard.error) return guard.error;
  const paths = await db.sopPath.findMany({
    orderBy: [{ toolId: "asc" }, { order: "asc" }],
    include: {
      tool: { select: { id: true, name: true, slug: true } },
      _count: { select: { steps: true } },
    },
  });
  return ok(
    paths.map((p) => ({
      id: p.id,
      toolId: p.toolId,
      toolName: p.tool.name,
      toolSlug: p.tool.slug,
      title: p.title,
      summary: p.summary,
      estMinutes: p.estMinutes,
      level: p.level,
      forRole: p.forRole,
      isLibraryPick: p.isLibraryPick,
      stepCount: p._count.steps,
    })),
  );
}

export async function POST(req: Request) {
  const guard = await requireAdmin("sops", "write");
  if (guard.error) return guard.error;
  const b = await req.json();
  if (!b.toolId || !b.title) return fail(400, "toolId 与 title 必填");
  const tool = await db.tool.findUnique({ where: { id: b.toolId } });
  if (!tool) return fail(404, "工具不存在");
  const order = await db.sopPath.count({ where: { toolId: b.toolId } });
  const path = await db.sopPath.create({
    data: {
      toolId: b.toolId,
      title: b.title,
      summary: b.summary ?? null,
      estMinutes: b.estMinutes ?? null,
      level: b.level ?? null,
      forRole: b.forRole ?? null,
      isLibraryPick: !!b.isLibraryPick,
      order,
    },
  });
  return ok(path, { status: 201 });
}
