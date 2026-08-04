import { db } from "@/lib/db";
import { ok, fail, corsHeaders } from "@/lib/http";
import { toolToApi } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const role = searchParams.get("role");
  const scene = searchParams.get("scene");
  const subject = searchParams.get("subject");
  const price = searchParams.get("price");
  const minRating = searchParams.get("minRating");
  const sort = searchParams.get("sort");

  const tools = await db.tool.findMany({
    where: { status: "published" },
    include: { paths: { include: { steps: true }, orderBy: { order: "asc" } } },
  });
  let list = tools.map(toolToApi);
  if (role) list = list.filter((t) => t.roles.includes(role));
  if (scene) list = list.filter((t) => t.scenes.includes(scene));
  if (subject) list = list.filter((t) => t.subjects.includes(subject));
  if (price) list = list.filter((t) => t.pricing === price);
  if (minRating) list = list.filter((t) => t.rating >= Number(minRating));
  if (sort === "rating") list.sort((a, b) => b.rating - a.rating);
  else if (sort === "name") list.sort((a, b) => a.name.localeCompare(b.name, "zh"));

  return ok(list, { headers: corsHeaders() });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
