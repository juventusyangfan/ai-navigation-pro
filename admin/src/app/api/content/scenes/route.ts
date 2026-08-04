import { db } from "@/lib/db";
import { ok, corsHeaders } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  const scenes = await db.scene.findMany();
  return ok(
    scenes.map((s) => ({
      key: s.key,
      name: s.name,
      cat: s.cat,
      icon: s.icon,
      roles: JSON.parse(s.roles || "[]"),
    })),
    { headers: corsHeaders() },
  );
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
