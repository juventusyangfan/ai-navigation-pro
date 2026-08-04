"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface PathRow {
  id: string;
  toolId: string;
  toolName: string;
  toolSlug: string;
  title: string;
  summary: string | null;
  estMinutes: number | null;
  level: string | null;
  forRole: string | null;
  isLibraryPick: boolean;
  stepCount: number;
}
interface ToolOpt {
  id: string;
  name: string;
  slug: string;
}

export default function SopsPage() {
  const [paths, setPaths] = useState<PathRow[]>([]);
  const [tools, setTools] = useState<ToolOpt[]>([]);
  const [toolId, setToolId] = useState("");
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/sops").then((r) => r.json()),
      fetch("/api/admin/tools").then((r) => r.json()),
    ]).then(([p, t]) => {
      setPaths(p);
      setTools(t);
      setToolId(t[0]?.id ?? "");
      setLoading(false);
    });
  }, []);

  async function create() {
    if (!toolId) return;
    const res = await fetch("/api/admin/sops", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toolId, title: "未命名 SOP 路径" }),
    });
    if (res.ok) {
      const p = await res.json();
      router.push(`/admin/sops/${p.id}`);
    }
  }

  async function del(id: string) {
    if (!confirm("确认删除该 SOP 路径及其全部步骤？")) return;
    await fetch(`/api/admin/sops/${id}`, { method: "DELETE" });
    setPaths((p) => p.filter((x) => x.id !== id));
  }

  const byTool = paths.reduce<Record<string, PathRow[]>>((acc, p) => {
    (acc[p.toolName] ??= []).push(p);
    return acc;
  }, {});

  return (
    <>
      <div className="page-head">
        <div>
          <h1>SOP 编辑器</h1>
          <div className="desc">路径 + 步骤可视化编辑，可标记「用法库精选」</div>
        </div>
        <div className="row-actions">
          <select className="inp" style={{ width: 180 }} value={toolId} onChange={(e) => setToolId(e.target.value)}>
            {tools.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <button className="btn primary" onClick={create} disabled={!toolId}>
            + 新建路径
          </button>
        </div>
      </div>

      {loading ? (
        <div className="empty">加载中…</div>
      ) : (
        Object.entries(byTool).map(([toolName, rows]) => (
          <div key={toolName} style={{ marginBottom: 18 }}>
            <h3 style={{ margin: "8px 0" }}>{toolName}</h3>
            <table className="tbl">
              <thead>
                <tr>
                  <th>路径标题</th>
                  <th>难度</th>
                  <th>角色</th>
                  <th>步骤</th>
                  <th>精选</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id}>
                    <td>{p.title}</td>
                    <td>{p.level ?? "—"}</td>
                    <td>{p.forRole ?? "—"}</td>
                    <td>{p.stepCount}</td>
                    <td>
                      {p.isLibraryPick ? (
                        <span className="badge ok">精选</span>
                      ) : (
                        <span className="badge">普通</span>
                      )}
                    </td>
                    <td>
                      <div className="row-actions">
                        <Link href={`/admin/sops/${p.id}`} className="btn sm">
                          编辑
                        </Link>
                        <button className="btn sm danger" onClick={() => del(p.id)}>
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}
    </>
  );
}
