// GET /api/health —— 健康检查
// 只报告"配置是否就位"，不暴露任何密钥内容。
// 上线后第一件事就是访问这个地址，能一眼看出是模型没配好还是库没建好。

import { guarded, ok } from "@/lib/http";
import { hasLlmKey, llmConfig } from "@/lib/llm";
import { hasTextKey } from "@/lib/crypto";
import { prisma } from "@/lib/store";
import { globalDailyCap, globalUsedToday } from "@/lib/quota";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return guarded("health", async () => {
    const cfg = llmConfig();
    let db: "ok" | string = "ok";
    let used = 0;
    try {
      used = await globalUsedToday();
    } catch (e) {
      db = (e as Error).message.slice(0, 120);
    }
    return ok({
      ok: db === "ok" && hasLlmKey() && hasTextKey(),
      service: "zuowen",
      db,
      llm: { configured: hasLlmKey(), model: cfg.model, baseUrl: cfg.baseUrl },
      textKey: hasTextKey(),
      today: { used, cap: globalDailyCap() },
      time: new Date().toISOString(),
    });
  });
}
