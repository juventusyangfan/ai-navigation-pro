import { requireAdmin } from "@/lib/http";
import { guarded } from "@/lib/api-guard";
import {
  zuowenConfigured,
  zuowenConfigHint,
  zuowenGet,
  type EssayListItem,
  type EssayListPayload,
} from "@/lib/zuowen/client";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 100;
const MAX_PAGES = 20; // 单次最多导出 2000 条，够一份周报用，也避免把 zuowen 拖住

/**
 * GET /api/admin/essays/export —— 导出 CSV
 *
 * ── 刻意不导出正文 ─────────────────────────────────────────────────────────
 * 导出文件会离开系统（邮件、U 盘、微信传输），是最容易失控的一环。
 * 孩子的作文正文属于未成年人原创内容，只保留在系统内按需查看，
 * 一旦成批导出，谁转发给谁都查不到。所以这里只导**结构化指标**。
 *
 * 同理不做「删除」接口：家长手里的报告链接是长期有效的，
 * 后台删一条就等于把某个家庭刚收到的报告变成 404，且无法解释。
 */
export async function GET(req: Request) {
  return guarded("admin/essays:export", async () => {
    const guard = await requireAdmin("essays", "read");
    if (guard.error) return guard.error;

    if (!zuowenConfigured()) {
      return Response.json({ error: "作文测评服务未配置", hint: zuowenConfigHint() }, { status: 503 });
    }

    const sp = new URL(req.url).searchParams;
    const filters = {
      grade: sp.get("grade") || undefined,
      source: sp.get("source") || undefined,
      level: sp.get("level") || undefined,
      q: (sp.get("q") || "").trim() || undefined,
      min: sp.get("min") || undefined,
      max: sp.get("max") || undefined,
      days: sp.get("days") || undefined,
    };

    const rows: EssayListItem[] = [];
    let page = 1;
    let totalPages = 1;

    while (page <= Math.min(totalPages, MAX_PAGES)) {
      const r = await zuowenGet<EssayListPayload>("/api/internal/reviews", {
        ...filters,
        page,
        pageSize: PAGE_SIZE,
        withText: 0,
      });
      if (!r.ok) {
        return Response.json({ error: r.error, hint: r.hint }, { status: r.status });
      }
      rows.push(...r.data.items);
      totalPages = r.data.totalPages;
      if (r.data.items.length === 0) break;
      page += 1;
    }

    const header = [
      "提交时间",
      "编号",
      "年级",
      "题目",
      "体裁",
      "字数",
      "来源",
      "总分",
      "等级",
      "内容立意",
      "结构条理",
      "语言表达",
      "用字规范",
      "模型",
    ];

    const lines = [header.map(csvCell).join(",")];
    for (const it of rows) {
      lines.push(
        [
          formatTime(it.createdAt),
          it.id,
          it.gradeLabel,
          it.title || "",
          it.genre || "",
          it.charCount,
          it.source === "image" ? "图片" : "文字",
          it.total,
          it.level,
          it.dims.content,
          it.dims.structure,
          it.dims.language,
          it.dims.norm,
          it.model,
        ]
          .map(csvCell)
          .join(","),
      );
    }

    // BOM：不加的话 Excel 打开中文会乱码（Windows 版默认按 GBK 解码）
    const csv = "\uFEFF" + lines.join("\r\n") + "\r\n";
    const day = new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10).replace(/-/g, "");

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="essays-${day}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  });
}

/** 北京时间。服务器时区通常是 UTC，直接用 toLocaleString 的默认时区会差 8 小时。 */
function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const cn = new Date(d.getTime() + 8 * 3600_000);
  return cn.toISOString().slice(0, 19).replace("T", " ");
}

/**
 * CSV 单元格转义。
 * 除了常规的引号/逗号/换行，还要处理**公式注入**：以 = + - @ 开头的值
 * 被 Excel 打开时会当公式执行（题目写成 "=1+1" 就会变成 2）。
 */
function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}
