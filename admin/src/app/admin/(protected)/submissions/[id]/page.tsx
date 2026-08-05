"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import ToolLogo from "@/components/ToolLogo";

interface Step {
  goal?: string;
  action?: string;
  prompt?: string;
  outputSample?: string;
  pitfall?: string;
  tip?: string;
}
interface Path {
  title?: string;
  level?: string;
  forRole?: string;
  steps?: Step[];
}
interface Tool {
  name?: string;
  url?: string;
  logo?: string;
  tagline?: string;
  roles?: string[];
  scenes?: string[];
  subjects?: string[];
  pricing?: string;
  platform?: string;
  compliance?: string;
  pros?: string[];
  cons?: string[];
  alts?: string[];
}
interface Scene {
  key: string;
  name: string;
}

function statusBadge(s: string) {
  const map: Record<string, { cls: string; text: string }> = {
    pending: { cls: "warn", text: "待审核" },
    approved: { cls: "ok", text: "已通过" },
    rejected: { cls: "bad", text: "已驳回" },
  };
  const m = map[s] || { cls: "", text: s };
  return <span className={`badge ${m.cls}`}>{m.text}</span>;
}

function Tags({ items, empty }: { items?: string[]; empty?: string }) {
  if (!items || items.length === 0) return <span className="muted">{empty || "—"}</span>;
  return (
    <div className="tag-row">
      {items.map((x, i) => (
        <span className="tag-chip" key={i}>
          {x}
        </span>
      ))}
    </div>
  );
}

export default function SubmissionDetailPage() {
  const params = useParams();
  const id = String(params.id);

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [status, setStatus] = useState("");
  const [createdAt, setCreatedAt] = useState("");
  const [submitterName, setSubmitterName] = useState("");
  const [tool, setTool] = useState<Tool | null>(null);
  const [paths, setPaths] = useState<Path[]>([]);
  const [sceneMap, setSceneMap] = useState<Record<string, string>>({});

  const [slug, setSlug] = useState("");
  const [color, setColor] = useState("#2f6bff");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [resultToolId, setResultToolId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/content/scenes")
      .then((r) => r.json())
      .then((d: Scene[]) => {
        const m: Record<string, string> = {};
        d.forEach((s) => (m[s.key] = s.name));
        setSceneMap(m);
      })
      .catch(() => {});

    fetch(`/api/admin/submissions/${id}`)
      .then((r) => {
        if (r.status === 404) {
          setNotFound(true);
          return null;
        }
        return r.json();
      })
      .then((d: any) => {
        if (!d) return;
        let payload: { tool?: Tool; paths?: Path[]; submitter?: { name?: string } } = {};
        try {
          payload = JSON.parse(d.payload);
        } catch {
          payload = {};
        }
        setTool(payload.tool || {});
        setPaths(Array.isArray(payload.paths) ? payload.paths : []);
        setSubmitterName(payload.submitter?.name || d.user?.name || "匿名");
        setStatus(d.status);
        setCreatedAt(d.createdAt);
        setResultToolId(d.resultToolId || null);
        setSlug((payload.tool?.name || "").trim().toLowerCase().replace(/\s+/g, "-"));
        setColor("#2f6bff");
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  async function convert() {
    if (!confirm("确认将该投稿转为正式工具并发布？")) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/submissions/${id}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: slug.trim(), color }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setStatus("approved");
        setResultToolId(data.toolId);
        setMsg({ kind: "ok", text: `已发布为工具（slug: ${data.slug}）` });
      } else {
        setMsg({ kind: "err", text: data.error || "转工具失败" });
      }
    } catch {
      setMsg({ kind: "err", text: "网络错误，请重试" });
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    const reason = prompt("驳回原因（可选，将记录）：");
    if (reason === null) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/submissions/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "rejected" }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setStatus("rejected");
        setMsg({ kind: "ok", text: "已驳回" });
      } else {
        setMsg({ kind: "err", text: data.error || "操作失败" });
      }
    } catch {
      setMsg({ kind: "err", text: "网络错误，请重试" });
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/submissions/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "pending" }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setStatus("pending");
        setMsg({ kind: "ok", text: "已重置为待审核" });
      } else {
        setMsg({ kind: "err", text: data.error || "操作失败" });
      }
    } catch {
      setMsg({ kind: "err", text: "网络错误，请重试" });
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="empty">加载中…</div>;
  if (notFound) return <div className="empty">投稿不存在</div>;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>投稿审核 · {tool?.name || "(未命名)"}</h1>
          <div className="desc">
            投稿人 {submitterName} · 投稿于 {new Date(createdAt).toLocaleString("zh-CN")} ·{" "}
            {statusBadge(status)}
          </div>
        </div>
        <Link href="/admin/submissions" className="btn sm">
          返回列表
        </Link>
      </div>

      {msg ? (
        <div className={`form-errors${msg.kind === "ok" ? " ok" : ""}`}>{msg.text}</div>
      ) : null}
      {status === "approved" && resultToolId ? (
        <div className="form-errors ok">
          已转为正式工具，
          <Link href={`/admin/tools/${resultToolId}`} className="link">
            前往查看工具
          </Link>
        </div>
      ) : null}

      <div className="review-grid">
        {/* 左：工具档案 */}
        <section className="card">
          <h3 className="sec-title">工具档案</h3>
          <div className="tool-head">
            <ToolLogo logo={tool?.logo || ""} name={tool?.name || "?"} color={color} size={40} />
            <div>
              <div className="tool-name">{tool?.name}</div>
              {tool?.url ? (
                <a href={tool.url} target="_blank" rel="noreferrer" className="link">
                  {tool.url}
                </a>
              ) : null}
            </div>
          </div>

          <div className="kv">
            <div className="k">一句话定位</div>
            <div className="v">{tool?.tagline || "—"}</div>
            <div className="k">适用角色</div>
            <div className="v">
              <Tags items={tool?.roles} />
            </div>
            <div className="k">适用场景</div>
            <div className="v">
              <Tags items={(tool?.scenes || []).map((s) => sceneMap[s] || s)} />
            </div>
            <div className="k">适用学科</div>
            <div className="v">
              <Tags items={tool?.subjects} />
            </div>
            <div className="k">收费模式</div>
            <div className="v">{tool?.pricing || "—"}</div>
            <div className="k">支持平台</div>
            <div className="v">{tool?.platform || "—"}</div>
            <div className="k">合规 / 隐私</div>
            <div className="v">{tool?.compliance || "—"}</div>
            <div className="k">核心亮点</div>
            <div className="v">
              <Tags items={tool?.pros} />
            </div>
            <div className="k">主要不足</div>
            <div className="v">
              <Tags items={tool?.cons} />
            </div>
            <div className="k">替代工具</div>
            <div className="v">
              <Tags items={tool?.alts} />
            </div>
          </div>
        </section>

        {/* 右：SOP + 操作 */}
        <div>
          <section className="card">
            <h3 className="sec-title">使用路径 SOP（{paths.length}）</h3>
            {paths.length === 0 ? (
              <div className="muted">该投稿未包含使用路径</div>
            ) : (
              paths.map((p, pi) => (
                <div className="path-block" key={pi}>
                  <div className="path-title">
                    <b>路径 {pi + 1}：{p.title}</b>
                    <span className="muted">
                      {p.level ? `难度 ${p.level}` : ""}
                      {p.forRole ? ` · ${p.forRole}` : ""}
                    </span>
                  </div>
                  <ol className="step-list">
                    {(p.steps || []).map((s, si) => (
                      <li key={si}>
                        <div className="step-goal">{s.goal || `步骤 ${si + 1}`}</div>
                        <div className="step-action">操作：{s.action}</div>
                        {s.prompt ? <div className="step-prompt">提示词：{s.prompt}</div> : null}
                        {s.outputSample ? (
                          <div className="muted">产出样例：{s.outputSample}</div>
                        ) : null}
                        {s.pitfall ? <div className="muted">注意：{s.pitfall}</div> : null}
                        {s.tip ? <div className="muted">技巧：{s.tip}</div> : null}
                      </li>
                    ))}
                  </ol>
                </div>
              ))
            )}
          </section>

          <section className="card">
            <h3 className="sec-title">审核操作</h3>
            {status !== "approved" ? (
              <>
                <label className="field">
                  <span>Slug（发布后的唯一标识，留空自动生成）</span>
                  <input
                    className="inp"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="如：yangcong"
                  />
                </label>
                <label className="field">
                  <span>主题色（Logo 回退底色 / 卡片点缀）</span>
                  <div className="color-row">
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                    />
                    <input
                      className="inp"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      style={{ flex: 1 }}
                    />
                  </div>
                </label>
                <div className="row-actions">
                  <button
                    className="btn primary"
                    onClick={convert}
                    disabled={busy || !tool?.name}
                  >
                    通过并发布为工具
                  </button>
                  <button className="btn danger" onClick={reject} disabled={busy}>
                    驳回
                  </button>
                </div>
              </>
            ) : (
              <div className="muted">该投稿已处理为正式工具。</div>
            )}
            {status !== "pending" ? (
              <div style={{ marginTop: 10 }}>
                <button className="btn sm" onClick={reset} disabled={busy}>
                  重置为待审核
                </button>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </>
  );
}
