"use client";

import { useState } from "react";
import {
  KNOWN_SCENE_KEYS,
  SCENE_LABEL,
  type CollectProposal,
} from "@/lib/collect/contract";
import ToolLogo from "@/components/ToolLogo";

type Row = CollectProposal & { include: boolean; pathCount?: number };

const wrap: React.CSSProperties = { maxWidth: 960, margin: "0 auto", padding: 24 };
const card: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 16,
  marginBottom: 16,
  background: "#fff",
};
const btn: React.CSSProperties = {
  background: "#2f6bff",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  padding: "10px 18px",
  cursor: "pointer",
  fontSize: 14,
};
const label: React.CSSProperties = { display: "block", fontSize: 13, color: "#374151", margin: "8px 0 4px" };
const input: React.CSSProperties = {
  width: "100%",
  border: "1px solid #d1d5db",
  borderRadius: 8,
  padding: "8px 10px",
  fontSize: 14,
  boxSizing: "border-box",
};

export default function CollectPage() {
  const [query, setQuery] = useState("采集关于“k12教育”的 AI 教学 / 作业 / 评测 / 家校沟通类工具");
  const [count, setCount] = useState(10);
  const [sceneFilter, setSceneFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState("");
  const [result, setResult] = useState<{ upserted: number; rejected: string[]; created: { slug: string; toolId: string; pathIds: string[] }[] } | null>(null);
  const [confirming, setConfirming] = useState(false);

  async function runCollect() {
    setLoading(true);
    setErr("");
    setResult(null);
    try {
      const res = await fetch("/api/admin/collect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "discover", query, count, sceneFilter }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "采集失败");
      const proposals: CollectProposal[] = data.proposals || [];
      if (proposals.length === 0) setErr("本轮未产出有效候选（可能全部未映射到已知场景，或 LLM 未返回）。");
      setRows(proposals.map((p) => ({ ...p, include: true, pathCount: p.paths?.length ?? 0 })));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "采集失败");
    } finally {
      setLoading(false);
    }
  }

  async function confirm() {
    const selected = rows.filter((r) => r.include);
    if (selected.length === 0) return;
    setConfirming(true);
    setErr("");
    try {
      const res = await fetch("/api/admin/collect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "confirm", proposals: selected }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "入库失败");
      setResult({ upserted: data.upserted || 0, rejected: data.rejected || [], created: data.created || [] });
      setRows((rs) => rs.filter((r) => !r.include));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "入库失败");
    } finally {
      setConfirming(false);
    }
  }

  function updateRow(slug: string, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.slug === slug ? { ...r, ...patch } : r)));
  }

  const selectedCount = rows.filter((r) => r.include).length;

  return (
    <div style={wrap}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>采集中心</h1>
      <p style={{ color: "#6b7280", fontSize: 14, marginTop: 0 }}>
        用 LLM 提议候选 → 验证 URL → 预览 → 勾选确认以 <b>draft</b> 入库（不自动覆盖已存在工具）。
      </p>

      <div style={card}>
        <label style={label}>采集需求</label>
        <textarea
          style={{ ...input, minHeight: 64, resize: "vertical" }}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="例如：采集面向家长的家校沟通工具 / 高中物理 AI 答疑类产品"
        />
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={label}>数量</label>
            <input
              style={input}
              type="number"
              min={1}
              max={30}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
            />
          </div>
          <div style={{ flex: 2 }}>
            <label style={label}>限定场景（可选）</label>
            <select style={input} value={sceneFilter} onChange={(e) => setSceneFilter(e.target.value)}>
              <option value="">不限</option>
              {KNOWN_SCENE_KEYS.map((k) => (
                <option key={k} value={k}>
                  {SCENE_LABEL[k]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div style={{ marginTop: 14 }}>
          <button style={btn} onClick={runCollect} disabled={loading}>
            {loading ? "采集中…" : "运行采集"}
          </button>
        </div>
      </div>

      {err && (
        <div style={{ ...card, borderColor: "#fca5a5", color: "#b91c1c", background: "#fef2f2" }}>{err}</div>
      )}

      {rows.length > 0 && (
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <b>候选预览（{rows.length} 条，已选 {selectedCount} 条）</b>
            <button style={btn} onClick={confirm} disabled={confirming || selectedCount === 0}>
              {confirming ? "入库中…" : `确认入库（转 draft）`}
            </button>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "#6b7280" }}>
                <th style={th}>选</th>
                <th style={th}>Logo</th>
                <th style={th}>名称</th>
                <th style={th}>slug（可改）</th>
                <th style={th}>URL（可改）</th>
                <th style={th}>角色 / 场景</th>
                <th style={th}>SOP</th>
                <th style={th}>校验</th>
                <th style={th}>合规护栏</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.slug} style={{ borderTop: "1px solid #f1f5f9" }}>
                  <td style={td}>
                    <input
                      type="checkbox"
                      checked={r.include}
                      onChange={(e) => updateRow(r.slug, { include: e.target.checked })}
                    />
                  </td>
                  <td style={td}>
                    <ToolLogo logo={r.logo} name={r.name} color="#2f6bff" size={28} />
                  </td>
                  <td style={td}>{r.name}</td>
                  <td style={td}>
                    <input
                      style={{ ...input, padding: "4px 6px", fontSize: 12 }}
                      value={r.slug}
                      onChange={(e) => updateRow(r.slug, { slug: e.target.value.toLowerCase().trim() })}
                    />
                  </td>
                  <td style={td}>
                    <input
                      style={{ ...input, padding: "4px 6px", fontSize: 12 }}
                      value={r.url}
                      onChange={(e) => updateRow(r.slug, { url: e.target.value.trim() })}
                    />
                  </td>
                  <td style={td}>
                    {r.roles.join("/")}
                    <br />
                    <span style={{ color: "#6b7280" }}>{r.scenes.map((s) => SCENE_LABEL[s] || s).join("、")}</span>
                  </td>
                  <td style={{ ...td, textAlign: "center", color: r.pathCount ? "#16a34a" : "#9ca3af" }}>
                    {r.pathCount ?? 0} 条
                  </td>
                  <td style={{ ...td, textAlign: "center" }}>
                    {r.urlVerified ? (
                      <span style={{ color: "#16a34a" }} title="URL 已验证">✓</span>
                    ) : r.urlWarning ? (
                      <span style={{ color: "#d97706" }} title={r.urlWarning}>⚠</span>
                    ) : (
                      <span style={{ color: "#dc2626" }} title="未验证可达">✗</span>
                    )}
                  </td>
                  <td style={{ ...td, color: "#6b7280" }}>{r.compliance}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {result && (
        <div style={{ ...card, borderColor: "#86efac", background: "#f0fdf4" }}>
          已入库 <b>{result.upserted}</b> 条（状态 draft）。
          {result.rejected.length > 0 && (
            <div style={{ marginTop: 8, color: "#b91c1c" }}>跳过：{result.rejected.join("；")}</div>
          )}
          {result.created.length > 0 && (
            <div style={{ marginTop: 10 }}>
              {result.created.map((c) => (
                <div key={c.slug} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, fontSize: 13 }}>
                  <b>{c.slug}</b>
                  {c.pathIds.length > 0 && (
                    c.pathIds.map((pid) => (
                      <a
                        key={pid}
                        href={`/admin/sops/${pid}`}
                        style={{ color: "#2f6bff", textDecoration: "underline", cursor: "pointer" }}
                      >
                        编辑 SOP →
                      </a>
                    ))
                  )}
                  {c.pathIds.length === 0 && (
                    <a
                      href={`/admin/tools/${c.toolId}`}
                      style={{ color: "#6b7280", textDecoration: "underline", cursor: "pointer" }}
                    >
                      去新建 SOP
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
          <div style={{ marginTop: 6, color: "#6b7280", fontSize: 13 }}>
            logo 已自动抓取（若为 ⚠ 请核对 URL）；去「工具管理」核对评分 / 翻 published。
          </div>
        </div>
      )}
    </div>
  );
}

const th: React.CSSProperties = { padding: "8px 6px", borderBottom: "2px solid #e5e7eb" };
const td: React.CSSProperties = { padding: "8px 6px", verticalAlign: "top" };
