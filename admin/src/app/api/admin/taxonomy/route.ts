import { db } from "@/lib/db";
import { requireAdmin, ok, fail } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireAdmin("taxonomy", "read");
  if (guard.error) return guard.error;
  const [categories, scenes] = await Promise.all([
    db.category.findMany({ orderBy: { order: "asc" } }),
    db.scene.findMany(),
  ]);
  return ok({
    categories,
    scenes: scenes.map((s) => ({ ...s, roles: JSON.parse(s.roles || "[]") })),
  });
}

export async function POST(req: Request) {
  const guard = await requireAdmin("taxonomy", "write");
  if (guard.error) return guard.error;
  const b = await req.json();
  if (!b.key || !b.name || !b.cat) return fail(400, "key/name/cat 必填");
  const exists = await db.scene.findUnique({ where: { key: b.key } });
  if (exists) return fail(409, "场景 key 已存在");
  const scene = await db.scene.create({
    data: {
      key: b.key,
      name: b.name,
      cat: b.cat,
      icon: b.icon ?? "Circle",
      roles: JSON.stringify(b.roles ?? ["老师"]),
    },
  });
  return ok(scene, { status: 201 });
}
