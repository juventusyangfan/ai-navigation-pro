"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ToolLogo from "@/components/ToolLogo";

interface Row {
  id: string;
  type: string;
  status: string;
  createdAt: string;
  toolName: string;
  toolUrl: string;
  toolLogo: string;
  pathCount: number;
  submitterName: string;
  resultToolId: string | null;
}

const TABS = [
  { key: "pending", label: "待审核" },
  { key: "approved", label: "已通过" },
  { key: "rejected", label: "已驳回" },
  { key: "all", label: "全部" },
] as const;

function statusBadge(s: string) {
  const map: Record<string, { cls: string; text: string }> = {
    pending: { cls: "warn", text: "待审核" },
    approved: { cls: "ok", text: "已通过" },
    rejected: { cls: "bad", text: "已驳回" },
  };
  const m = map[s] || { cls: "", text: s };
  return <span className={`badge ${m.cls}`}>{m.text}</span>;
}

export default function SubmissionsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<string>("pending");

  useEffect(() => {
    setLoading(true);
    fetch("/api/admin/submissions?status=all")
      .then((r) => r.json())
      .then((d: Row[]) => {
        setRows(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const visible = tab === "all" ? rows : rows.filter((r) => r.status === tab);
  const counts = {
    pending: rows.filter((r) => r.status === "pending").length,
    approved: rows.filter((r) => r.status === "approved").length,
    rejected: rows.filter((r) => r.status === "rejected").length,
    all: rows.length,
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>投稿审核</h1>
          <div className="desc">前台用户投稿的工具与 SOP，审核通过后一键转为正式工具</div>
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

      {loading ? (
        <div className="empty">加载中…</div>
      ) : (
        <table className="tbl">
          <thead>
            <tr>
              <th>工具</th>
              <th>官网</th>
              <th>投稿人</th>
              <th>SOP</th>
              <th>状态</th>
              <th>投稿时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.id}>
                <td>
                  <ToolLogo logo={r.toolLogo} name={r.toolName} color="#2f6bff" size={22} />
                  <span style={{ marginLeft: 8 }}>{r.toolName}</span>
                </td>
                <td>
                  {r.toolUrl ? (
                    <a href={r.toolUrl} target="_blank" rel="noreferrer" className="link">
                      {r.toolUrl.replace(/^https?:\/\//, "")}
                    </a>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                <td>{r.submitterName}</td>
                <td>{r.pathCount}</td>
                <td>{statusBadge(r.status)}</td>
                <td className="muted">{new Date(r.createdAt).toLocaleString("zh-CN")}</td>
                <td>
                  <div className="row-actions">
                    <Link href={`/admin/submissions/${r.id}`} className="btn sm">
                      查看
                    </Link>
                    {r.status === "approved" && r.resultToolId ? (
                      <Link href={`/admin/tools/${r.resultToolId}`} className="btn sm">
                        工具
                      </Link>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={7} className="empty">
                  暂无{tab === "all" ? "" : TABS.find((t) => t.key === tab)?.label}投稿
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </>
  );
}
