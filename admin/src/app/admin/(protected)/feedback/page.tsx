"use client";

import { useEffect, useState } from "react";

interface Row {
  id: string;
  type: string;
  text: string;
  status: string;
  createdAt: string;
  toolName: string;
  toolSlug: string;
  userName: string;
}

const TABS = [
  { key: "pending", label: "待处理" },
  { key: "approved", label: "已采纳" },
  { key: "rejected", label: "已忽略" },
  { key: "all", label: "全部" },
] as const;

function statusBadge(s: string) {
  const map: Record<string, { cls: string; text: string }> = {
    pending: { cls: "warn", text: "待处理" },
    approved: { cls: "ok", text: "已采纳" },
    rejected: { cls: "bad", text: "已忽略" },
  };
  const m = map[s] || { cls: "", text: s };
  return <span className={`badge ${m.cls}`}>{m.text}</span>;
}

export default function FeedbackPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<string>("pending");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    setLoading(true);
    setErr("");
    fetch("/api/admin/feedback?status=all")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: Row[]) => {
        setRows(d);
        setLoading(false);
      })
      .catch(() => {
        setErr("加载失败");
        setLoading(false);
      });
  }, []);

  const visible = tab === "all" ? rows : rows.filter((r) => r.status === tab);
  const counts = {
    pending: rows.filter((r) => r.status === "pending").length,
    approved: rows.filter((r) => r.status === "approved").length,
    rejected: rows.filter((r) => r.status === "rejected").length,
    all: rows.length,
  };

  const resolve = async (id: string, status: "approved" | "rejected") => {
    setBusy(id);
    setErr("");
    try {
      const r = await fetch(`/api/admin/feedback/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (r.ok) {
        setRows((prev) => prev.map((x) => (x.id === id ? { ...x, status } : x)));
      } else {
        setErr("操作失败");
      }
    } catch {
      setErr("网络异常");
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>反馈管理</h1>
          <div className="desc">前台用户对工具的纠错与补充建议，审核后采纳或忽略</div>
        </div>
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`tab${tab === t.key ? " active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            <span className="tab-count">{counts[t.key]}</span>
          </button>
        ))}
      </div>

      {err && <div className="empty err">{err}</div>}

      {loading ? (
        <div className="empty">加载中…</div>
      ) : (
        <table className="tbl">
          <thead>
            <tr>
              <th>类型</th>
              <th>工具</th>
              <th>反馈人</th>
              <th>内容</th>
              <th>状态</th>
              <th>时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.id}>
                <td>{r.type}</td>
                <td>
                  <a
                    href={`/tool/${r.toolSlug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="link"
                  >
                    {r.toolName}
                  </a>
                </td>
                <td>{r.userName}</td>
                <td style={{ maxWidth: 360, whiteSpace: "pre-wrap" }}>{r.text}</td>
                <td>{statusBadge(r.status)}</td>
                <td className="muted">{new Date(r.createdAt).toLocaleString("zh-CN")}</td>
                <td>
                  <div className="row-actions">
                    {r.status !== "approved" && (
                      <button
                        className="btn sm ok"
                        disabled={busy === r.id}
                        onClick={() => resolve(r.id, "approved")}
                      >
                        采纳
                      </button>
                    )}
                    {r.status !== "rejected" && (
                      <button
                        className="btn sm bad"
                        disabled={busy === r.id}
                        onClick={() => resolve(r.id, "rejected")}
                      >
                        忽略
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={7} className="empty">
                  暂无{TABS.find((t) => t.key === tab)?.label}反馈
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </>
  );
}
