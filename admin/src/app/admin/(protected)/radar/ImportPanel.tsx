"use client";

import { useRef, useState } from "react";
import { readApi } from "@/lib/radar/api-client";

interface Sibling {
  name: string;
  location?: string;
  signupMethod?: string;
  notes?: string;
}

interface PreviewRow {
  externalId: string;
  name: string;
  organizer: string;
  coOrganizer: string | null;
  audienceRaw: string;
  grades: string[];
  roles: string[];
  gradeLabel: string;
  roleLabel: string;
  category: string;
  categoryLabel: string;
  region: string;
  regionLabel: string;
  keyDate: string;
  keyDateType: string;
  keyDateTypeLabel: string;
  location: string | null;
  fee: string;
  signupMethod: string;
  sourceName: string;
  sourceUrl: string;
  sourceTier: number;
  notes: string | null;
  siblings: Sibling[];
  rScore: number;
  tScore: number;
  cScore: number;
  suggestedTotal: number;
  suggestedBucket: string;
  bucketLabel: string;
  promoted: boolean;
  gatePassed: boolean;
  gateCodes: string[];
  warnings: string[];
  complianceNote: string;
}

interface PreviewResp {
  phase: "preview";
  version: { schemaVersion: string | null; warning: string | null };
  window: { runDate: string; start: string | null; end: string | null; title: string };
  fileHash: string;
  fileName: string | null;
  duplicate: { editionId: string; title: string; createdAt: string } | null;
  counts: {
    total: number;
    accepted: number;
    blocked: number;
    A: number;
    B: number;
    C: number;
    promoted: number;
  };
  items: PreviewRow[];
  upstreamRejected: { name: string; organizer: string; reason: string }[];
}

interface CommitResp {
  editionId: string;
  title: string;
  counts: { total: number; accepted: number; blocked: number; created: number; updated: number };
}

const BUCKET_CLASS: Record<string, string> = { A: "ok", B: "warn", C: "draft" };

/**
 * 导入面板。
 *
 * 关键设计：**预览与入库是两次独立的服务端请求**，且入库时服务端会重新解析原始文本、
 * 重跑门槛与打分——绝不信任前端回传的字段值。前端只传「勾选了哪些 externalId」。
 */
export default function ImportPanel({ onDone }: { onDone: () => void }) {
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [err, setErr] = useState("");
  const [preview, setPreview] = useState<PreviewResp | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [committed, setCommitted] = useState<CommitResp | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function pickFile(f: File | undefined) {
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      setText(String(reader.result ?? ""));
      setFileName(f.name);
      setPreview(null);
      setCommitted(null);
      setErr("");
    };
    reader.readAsText(f, "utf-8");
  }

  async function runPreview() {
    setLoading(true);
    setErr("");
    setCommitted(null);
    try {
      const res = await fetch("/api/admin/radar/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "preview", text, fileName }),
      });
      const p = await readApi<PreviewResp>(res);
      setPreview(p);
      setSelected(new Set(p.items.filter((r) => r.gatePassed).map((r) => r.externalId)));
    } catch (e) {
      setPreview(null);
      setErr(e instanceof Error ? e.message : "解析失败");
    } finally {
      setLoading(false);
    }
  }

  async function commit() {
    if (!preview) return;
    setCommitting(true);
    setErr("");
    try {
      const res = await fetch("/api/admin/radar/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "commit", text, fileName, selected: [...selected] }),
      });
      const data = await readApi<CommitResp>(res);
      setCommitted(data);
      setPreview(null);
      setText("");
      setFileName("");
      if (fileRef.current) fileRef.current.value = "";
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "入库失败");
    } finally {
      setCommitting(false);
    }
  }

  const toggle = (id: string, on: boolean) =>
    setSelected((s) => {
      const next = new Set(s);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const acceptedRows = preview?.items.filter((r) => r.gatePassed) ?? [];
  const blockedRows = preview?.items.filter((r) => !r.gatePassed) ?? [];

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>① 选择技能产出文件</div>
        <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 12px" }}>
          上传 <code>edu-event-radar/output/edu-events-YYYY-MM-DD.json</code>，或直接把 JSON 文本粘贴到下方。
          入库前服务端会重跑一遍硬门槛（地域 / 对象 / 时效 / 信源层级 ≤3）与话术红线扫描。
        </p>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            onChange={(e) => pickFile(e.target.files?.[0])}
          />
          {fileName && <span className="badge">{fileName}</span>}
        </div>
        <label className="field">
          <span>或粘贴 JSON 文本</span>
          <textarea
            className="inp"
            style={{ minHeight: 110 }}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setPreview(null);
            }}
            placeholder='{"meta": {...}, "items": [...]}'
          />
        </label>
        <button className="btn primary" onClick={runPreview} disabled={loading || !text.trim()}>
          {loading ? "解析中…" : "解析并预览"}
        </button>
      </div>

      {err && <div className="form-errors" style={{ marginBottom: 16 }}>{err}</div>}

      {committed && (
        <div className="form-errors ok" style={{ marginBottom: 16 }}>
          已入库期次「{committed.title}」：共 {committed.counts.total} 条，通过门槛 {committed.counts.accepted} 条
          （新增 {committed.counts.created} / 更新 {committed.counts.updated}），拦截 {committed.counts.blocked} 条。
          全部为 <b>草稿</b> 状态，请到「条目维护」核对后发布。
        </div>
      )}

      {preview && (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
              <div>
                <div style={{ fontWeight: 700 }}>② 预览：{preview.window.title}</div>
                <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>
                  运行日 {preview.window.runDate}
                  {preview.window.start && preview.window.end
                    ? ` · 覆盖窗口 ${preview.window.start} ~ ${preview.window.end}`
                    : ""}
                  {preview.version.schemaVersion ? ` · 契约版本 ${preview.version.schemaVersion}` : ""}
                </div>
              </div>
              <div style={{ display: "flex", gap: 20 }}>
                <Stat label="解析条目" value={preview.counts.total} />
                <Stat label="通过门槛" value={preview.counts.accepted} good />
                <Stat label="被拦截" value={preview.counts.blocked} bad={preview.counts.blocked > 0} />
                <Stat label="主推/备选/简讯" value={`${preview.counts.A}/${preview.counts.B}/${preview.counts.C}`} />
              </div>
            </div>
            {preview.version.warning && (
              <div className="badge warn" style={{ marginTop: 10 }}>{preview.version.warning}</div>
            )}
            {preview.counts.promoted > 0 && (
              <div style={{ color: "var(--muted)", fontSize: 12.5, marginTop: 8 }}>
                其中 {preview.counts.promoted} 条由保底规则从备选提升为主推（A 档不足 2 条时自动补足）。
              </div>
            )}
            {preview.duplicate && (
              <div className="form-errors" style={{ marginTop: 12, marginBottom: 0 }}>
                该文件已于 {preview.duplicate.createdAt.slice(0, 10)} 导入过（期次「{preview.duplicate.title}」）。
                如需重新导入，请先到「上传历史」回滚该批次。
              </div>
            )}
          </div>

          <div className="card" style={{ marginBottom: 16, overflowX: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontWeight: 700 }}>
                ③ 勾选入库（已选 {selected.size} / {acceptedRows.length}）
              </div>
              <div className="row-actions">
                <button
                  className="btn sm"
                  onClick={() => setSelected(new Set(acceptedRows.map((r) => r.externalId)))}
                >
                  全选通过项
                </button>
                <button className="btn sm" onClick={() => setSelected(new Set())}>
                  清空
                </button>
                <button className="btn primary" onClick={commit} disabled={committing || selected.size === 0 || !!preview.duplicate}>
                  {committing ? "入库中…" : "确认入库（转草稿）"}
                </button>
              </div>
            </div>

            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: 36 }}>选</th>
                  <th>活动 / 主办方</th>
                  <th>对象</th>
                  <th>类别</th>
                  <th>关键节点</th>
                  <th>信源</th>
                  <th style={{ width: 90 }}>建议分</th>
                  <th style={{ width: 64 }}>档位</th>
                </tr>
              </thead>
              <tbody>
                {acceptedRows.map((r) => (
                  <tr key={r.externalId}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selected.has(r.externalId)}
                        onChange={(e) => toggle(r.externalId, e.target.checked)}
                      />
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{r.name}</div>
                      <div style={{ color: "var(--muted)", fontSize: 12 }}>{r.organizer}</div>
                      {r.siblings.length > 0 && (
                        <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 2 }}>
                          同系列：{r.siblings.map((s) => s.name).join("；")}
                        </div>
                      )}
                      {r.warnings.length > 0 && (
                        <div style={{ color: "var(--warn)", fontSize: 12, marginTop: 2 }}>
                          ⚠ 待复核表述：{r.warnings.join("、")}
                        </div>
                      )}
                    </td>
                    <td>
                      {r.gradeLabel}
                      <div style={{ color: "var(--muted)", fontSize: 12 }}>{r.roleLabel}</div>
                    </td>
                    <td>{r.categoryLabel}</td>
                    <td>
                      {r.keyDateTypeLabel}
                      <div style={{ color: "var(--muted)", fontSize: 12 }}>{r.keyDate}</div>
                    </td>
                    <td>
                      {r.sourceName}
                      <div style={{ color: "var(--muted)", fontSize: 12 }}>{r.sourceTier} 级</div>
                    </td>
                    <td>
                      <b>{r.suggestedTotal}</b>
                      <div style={{ color: "var(--muted)", fontSize: 11.5 }}>
                        R{r.rScore}/T{r.tScore}/C{r.cScore}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${BUCKET_CLASS[r.suggestedBucket] ?? ""}`}>{r.bucketLabel}</span>
                      {r.promoted && (
                        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>保底提升</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {blockedRows.length > 0 && (
            <div className="card" style={{ marginBottom: 16, borderColor: "#fecdd3" }}>
              <div style={{ fontWeight: 700, marginBottom: 8, color: "var(--danger)" }}>
                被硬门槛拦截 {blockedRows.length} 条（同样入库留痕，但无法发布）
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                {blockedRows.map((r) => (
                  <li key={r.externalId} style={{ marginBottom: 4 }}>
                    <b>{r.name || "（无名称）"}</b>
                    <span style={{ color: "var(--danger)" }}> —— {r.gateCodes.join("；")}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {preview.upstreamRejected.length > 0 && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 700, marginBottom: 8, color: "var(--muted)" }}>
                技能侧已剔除 {preview.upstreamRejected.length} 条（未进入本次评审）
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: "var(--muted)" }}>
                {preview.upstreamRejected.map((r, i) => (
                  <li key={i}>
                    {r.name}
                    {r.reason ? ` —— ${r.reason}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, good, bad }: { label: string; value: number | string; good?: boolean; bad?: boolean }) {
  return (
    <div className="stat" style={{ textAlign: "right" }}>
      <div className="label">{label}</div>
      <div
        className="num"
        style={{ fontSize: 20, color: good ? "var(--ok)" : bad ? "var(--danger)" : undefined }}
      >
        {value}
      </div>
    </div>
  );
}
