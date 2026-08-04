"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface PickRow {
  id: string;
  toolName: string;
  title: string;
  summary: string | null;
  estMinutes: number | null;
  level: string | null;
  forRole: string | null;
  stepCount: number;
}

export default function UsagesPage() {
  const [rows, setRows] = useState<PickRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/sops")
      .then((r) => r.json())
      .then((d) => {
        setRows(
          d
            .filter((p: { isLibraryPick: boolean } & PickRow) => p.isLibraryPick)
            .map((p: PickRow) => ({ ...p })),
        );
        setLoading(false);
      });
  }, []);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>用法库</h1>
          <div className="desc">sop_paths 中标记为「精选」的视图（useful/collect 计数为种子值，Phase 3 接真实互动）</div>
        </div>
        <Link href="/admin/sops" className="btn">
          去 SOP 编辑器标记精选
        </Link>
      </div>

      {loading ? (
        <div className="empty">加载中…</div>
      ) : (
        <table className="tbl">
          <thead>
            <tr>
              <th>用法标题</th>
              <th>工具</th>
              <th>难度</th>
              <th>角色</th>
              <th>步骤</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td>
                  <b>{p.title}</b>
                  {p.summary && <div style={{ color: "var(--muted)", fontSize: 12 }}>{p.summary}</div>}
                </td>
                <td>{p.toolName}</td>
                <td>{p.level ?? "—"}</td>
                <td>{p.forRole ?? "—"}</td>
                <td>{p.stepCount}</td>
                <td>
                  <Link href={`/admin/sops/${p.id}`} className="btn sm">
                    编辑
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="empty">
                  暂无精选用法，在 SOP 编辑器勾选「设为用法库精选」
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </>
  );
}
