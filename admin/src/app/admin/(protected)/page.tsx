import Link from "next/link";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [tools, published, drafts, paths, picks, rating, feedbackPending, submissionsPending] =
    await Promise.all([
      db.tool.count(),
      db.tool.count({ where: { status: "published" } }),
      db.tool.count({ where: { status: "draft" } }),
      db.sopPath.count(),
      db.sopPath.count({ where: { isLibraryPick: true } }),
      db.tool.aggregate({ _avg: { rating: true } }),
      db.feedback.count({ where: { status: "pending" } }),
      db.submission.count({ where: { status: "pending" } }),
    ]);

  const cards = [
    { label: "工具总数", num: tools, hint: `已发布 ${published} · 草稿 ${drafts}` },
    { label: "SOP 路径", num: paths, hint: `用法库精选 ${picks}` },
    { label: "平均评分", num: (rating._avg.rating ?? 0).toFixed(2), hint: "全部工具均分" },
    { label: "待审", num: feedbackPending + submissionsPending, hint: "反馈 + 投稿（Phase 3）" },
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>仪表盘</h1>
          <div className="desc">内容总览 · 实时来自数据库</div>
        </div>
        <Link href="/admin/tools" className="btn primary">
          管理工具
        </Link>
      </div>

      <div className="grid cols-4">
        {cards.map((c) => (
          <div className="card stat" key={c.label}>
            <div className="label">{c.label}</div>
            <div className="num">{c.num}</div>
            <div className="hint">{c.hint}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <h3 style={{ marginTop: 0 }}>快速入口</h3>
        <ul style={{ margin: 0, paddingLeft: 18, color: "var(--muted)" }}>
          <li>
            <Link href="/admin/tools" style={{ color: "var(--primary)" }}>
              工具管理
            </Link>
            ：维护工具档案（角色 / 学科 / 定价 / 优缺点 / 合规），支持新增与编辑。
          </li>
          <li>
            <Link href="/admin/sops" style={{ color: "var(--primary)" }}>
              SOP 编辑器
            </Link>
            ：核心模块，可视化编辑「路径 + 步骤」，并标记用法库精选。
          </li>
          <li>
            <Link href="/admin/usages" style={{ color: "var(--primary)" }}>
              用法库
            </Link>
            ：查看 isLibraryPick 的 SOP 视图与统计。
          </li>
          <li>
            <Link href="/admin/taxonomy" style={{ color: "var(--primary)" }}>
              分类法
            </Link>
            ：维护场景（scenes）与分类（categories）。
          </li>
        </ul>
      </div>
    </>
  );
}
