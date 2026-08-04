import { fail } from "@/lib/http";

export const dynamic = "force-dynamic";

// 公开站用户互动 API（收藏 / 评分 / 笔记 / 反馈 / 投稿）计划于 Phase 3 落库。
// 表结构已在 prisma/schema.prisma 建好（User/Favorite/Rating/Note/Feedback/Submission）。
export async function GET() {
  return fail(501, "公开站用户互动 API 计划于 Phase 3 落地");
}
export async function POST() {
  return fail(501, "公开站用户互动 API 计划于 Phase 3 落地");
}
