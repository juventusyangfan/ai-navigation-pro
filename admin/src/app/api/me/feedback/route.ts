import { fail } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  return fail(501, "公开站用户互动 API 计划于 Phase 3 落地");
}
export async function POST() {
  return fail(501, "公开站用户互动 API 计划于 Phase 3 落地");
}
