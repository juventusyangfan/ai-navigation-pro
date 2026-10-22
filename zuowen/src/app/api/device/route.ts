// GET /api/device —— 家长端「本机识别码」
//
// 页面一打开就调用，作用是两件：
//   1. 首次访问即签发 anonId（而不是等第一次提交成功后才发）。这样家长马上
//      能看到自己的识别码，念给老师；提交前的额度检查也有了身份。
//   2. 顺手返回今天的剩余次数，让家长在点「开始测评」之前就知道还能不能用，
//      而不是填完一整篇才被 429 弹回来。
//
// 返回体里**不含** anonId：识别码只是给人看的标签，页面上不需要也不该拿到内部 ID。
// 即便有人从 devtools 改了 Cookie 冒充另一台设备，最多只是拿到那台设备的额度，
// 拿不到任何作文内容（报告按 id 访问，id 不可枚举）。

import { guarded, ok } from "@/lib/http";
import { anonCookieHeader, dailyLimit, newAnonId, readAnonId, usedToday } from "@/lib/quota";
import { ensureDevice, formatCode, planFor } from "@/lib/device";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return guarded("device", async () => {
    const existing = await readAnonId();
    const anonId = existing ?? newAnonId();

    const dev = await ensureDevice(anonId);
    const used = await usedToday(anonId);
    const plan = await planFor(anonId, used, dailyLimit());

    const res = ok({
      ok: true,
      code: dev.code,
      display: formatCode(dev.code),
      limited: plan.limited,
      limit: plan.limit,
      used,
      remaining: plan.limit === null ? null : Math.max(0, plan.limit - used),
    });

    if (!existing) res.headers.append("Set-Cookie", anonCookieHeader(anonId));
    return res;
  });
}
