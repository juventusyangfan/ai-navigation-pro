export default function ComingSoon({ title, desc }: { title: string; desc: string }) {
  return (
    <>
      <div className="page-head">
        <div>
          <h1>{title}</h1>
          <div className="desc">{desc}</div>
        </div>
      </div>
      <div className="card empty">
        该模块计划在 <b>Phase 3（互动与审核）</b> 落地。数据库表结构已在
        <code> prisma/schema.prisma</code> 中预留（User / Rating / Favorite / Note / Feedback /
        Submission / Push）。API 路由 <code>/api/me/*</code> 已占位返回 501。
      </div>
    </>
  );
}
