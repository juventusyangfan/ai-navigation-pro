"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ToolLogo from "@/components/ToolLogo";

interface ToolRow {
  id: string;
  slug: string;
  name: string;
  logo: string;
  color: string;
  pricing: string;
  rating: number;
  status: string;
  pathCount: number;
}

export default function ToolsPage() {
  const [rows, setRows] = useState<ToolRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/tools")
      .then((r) => r.json())
      .then((d) => {
        setRows(d);
        setLoading(false);
      });
  }, []);

  async function del(id: string) {
    if (!confirm("确认删除该工具及其全部 SOP 路径？")) return;
    await fetch(`/api/admin/tools/${id}`, { method: "DELETE" });
    setRows((r) => r.filter((x) => x.id !== id));
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>工具管理</h1>
          <div className="desc">维护工具档案与元信息（SOP 在「SOP 编辑器」维护）</div>
        </div>
        <Link href="/admin/tools/new" className="btn primary">
          + 新建工具
        </Link>
      </div>

      {loading ? (
        <div className="empty">加载中…</div>
      ) : (
        <table className="tbl">
          <thead>
            <tr>
              <th>名称</th>
              <th>slug</th>
              <th>定价</th>
              <th>评分</th>
              <th>SOP</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id}>
                <td>
                  <ToolLogo logo={t.logo} name={t.name} color={t.color} size={22} />
                  <span style={{ marginLeft: 8 }}>{t.name}</span>
                </td>
                <td>
                  <code>{t.slug}</code>
                </td>
                <td>{t.pricing}</td>
                <td>{t.rating.toFixed(1)}</td>
                <td>{t.pathCount}</td>
                <td>
                  <span className={`badge ${t.status === "published" ? "ok" : "draft"}`}>
                    {t.status === "published" ? "已发布" : "草稿"}
                  </span>
                </td>
                <td>
                  <div className="row-actions">
                    <Link href={`/admin/tools/${t.id}`} className="btn sm">
                      编辑
                    </Link>
                    <button className="btn sm danger" onClick={() => del(t.id)}>
                      删除
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="empty">
                  暂无工具，点右上角新建
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </>
  );
}
