"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface LinkRow {
  id: string;
  slug: string;
  title: string;
  moduleTitle: string;
  moduleSlug: string;
  source: string;
  officialUrl?: string;
  fallbackUrl?: string;
  linkStatus: string;
  linkCheckedAt?: string;
  linkHttpCode?: number;
  linkFinalUrl?: string;
  linkFailCount: number;
}

const linkBadge = (s: string) => {
  if (s === "ok") return <span className="badge ok">正常</span>;
  if (s === "warn") return <span className="badge warn">可疑</span>;
  if (s === "broken") return <span className="badge danger">失效</span>;
  return <span className="badge">未检</span>;
};

export default function LinkHealth() {
  const [rows, setRows] = useState<LinkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const router = useRouter();

  function load() {
    setLoading(true);
    const qs = status ? `?status=${status}` : "";
    fetch(`/api/admin/literacy/links${qs}`)
      .then((r) => r.json())
      .then((d: LinkRow[]) => {
        setRows(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  useEffect(load, [status]);

  async function checkOne(id: string) {
    setMsg("");
    const res = await fetch(`/api/admin/literacy/lessons/${id}/check-link`, { method: "POST" });
    if (res.ok) {
      const d = await res.json();
      setRows((rs) => rs.map((r) => (r.id === id ? { ...r, linkStatus: d.status, linkHttpCode: d.httpCode, linkFinalUrl: d.finalUrl } : r)));
      setMsg(`已探活：${d.status}`);
    } else {
      setMsg("探活失败");
    }
  }

  async function checkAll() {
    setBusy(true);
    setMsg("批量探活中…");
    const res = await fetch("/api/admin/literacy/link-check", { method: "POST" });
    setBusy(false);
    if (res.ok) {
      const d = await res.json();
      setMsg(`批量探活完成：${d.checked} 条`);
      load();
    } else {
      const e = await res.json().catch(() => ({}));
      setMsg(e.error || "批量探活失败（需 literacy:write 或 cron token）");
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>外链健康</h1>
          <div className="desc">AI 通识课官方课外链探活（国家平台风控可能误判，可人工覆盖）</div>
        </div>
        <div className="row-actions">
          <Link href="/admin/literacy" className="btn">
            返回总览
          </Link>
          <button className="btn primary" onClick={checkAll} disabled={busy}>
            {busy ? "探活中…" : "批量探活全部"}
          </button>
        </div>
      </div>

      <div className="row-actions" style={{ marginBottom: 10 }}>
        <select className="inp" style={{ width: 160 }} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">全部状态</option>
          <option value="broken">失效</option>
          <option value="warn">可疑</option>
          <option value="ok">正常</option>
          <option value="unchecked">未检</option>
        </select>
      </div>

      {msg && <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 8 }}>{msg}</div>}

      {loading ? (
        <div className="empty">加载中…</div>
      ) : rows.length === 0 ? (
        <div className="empty">无数据</div>
      ) : (
        <table className="tbl">
          <thead>
            <tr>
              <th>课时</th>
              <th>模块</th>
              <th>状态</th>
              <th>HTTP</th>
              <th>落点</th>
              <th>失败次数</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link href={`/admin/literacy/lessons/${r.id}`} className="muted">
                    {r.title}
                  </Link>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>{r.slug}</div>
                </td>
                <td>
                  <Link href={`/literacy/${r.moduleSlug}`} className="muted">
                    {r.moduleTitle}
                  </Link>
                </td>
                <td>{linkBadge(r.linkStatus)}</td>
                <td>{r.linkHttpCode ?? "-"}</td>
                <td style={{ maxWidth: 260, fontSize: 12 }}>
                  {r.linkFinalUrl ? (
                    <span className="muted" style={{ wordBreak: "break-all" }}>
                      {r.linkFinalUrl}
                    </span>
                  ) : (
                    "-"
                  )}
                </td>
                <td>{r.linkFailCount}</td>
                <td>
                  <button className="btn sm" onClick={() => checkOne(r.id)} disabled={!r.officialUrl}>
                    探活
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
