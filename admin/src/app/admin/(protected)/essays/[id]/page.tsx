"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { readApi } from "@/lib/read-api";
import type { EssayDetailItem, EssayDim } from "@/lib/zuowen/client";

/**
 * 作文测评 · 单篇详情（只读）
 *
 * 正文默认**不加载**：先取元信息与报告，需要核对原文时再点一次「显示原文」。
 * 孩子的作文不该在打开页面的瞬间就铺在屏幕上，尤其在办公室或投屏场景。
 */

const DIM_ORDER: (keyof EssayDim)[] = ["content", "structure", "language", "norm"];

const LEVEL_STYLE: Record<string, string> = {
  优秀: "ok",
  良好: "",
  合格: "warn",
  待提升: "bad",
};

type DetailResponse = { ok: true; item: EssayDetailItem; publicUrl: string };

export default function EssayDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [item, setItem] = useState<EssayDetailItem | null>(null);
  const [publicUrl, setPublicUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [text, setText] = useState<string | null>(null);
  const [textLoading, setTextLoading] = useState(false);
  const [textError, setTextError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    fetch(`/api/admin/essays/${id}`)
      .then((r) => readApi<DetailResponse>(r))
      .then((d) => {
        if (!alive) return;
        setItem(d.item);
        setPublicUrl(d.publicUrl || "");
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : "加载失败");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [id]);

  const showText = async () => {
    setTextLoading(true);
    setTextError("");
    try {
      const d = await readApi<DetailResponse>(await fetch(`/api/admin/essays/${id}?text=1`));
      setText(d.item.text ?? "");
    } catch (e) {
      setTextError(e instanceof Error ? e.message : "正文加载失败");
    } finally {
      setTextLoading(false);
    }
  };

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 非 https 或浏览器禁用剪贴板时退回手动复制
      window.prompt("复制下面的报告链接：", publicUrl);
    }
  };

  if (loading) {
    return <div className="empty">加载中…</div>;
  }

  if (error || !item) {
    return (
      <>
        <div className="page-head">
          <div>
            <h1>作文测评 · 详情</h1>
          </div>
          <Link href="/admin/essays" className="btn btn-sm">
            返回列表
          </Link>
        </div>
        <div className="form-errors">{error || "记录不存在"}</div>
      </>
    );
  }

  const report = item.report;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>作文测评 · 详情</h1>
          <div className="desc">
            {item.gradeLabel}
            {item.genre ? ` · ${item.genre}` : ""} · {item.charCount} 字 · {item.source === "image" ? "图片上传" : "文字输入"}
          </div>
        </div>
        <div className="row-actions">
          <button className="btn btn-sm" onClick={copyUrl}>
            {copied ? "已复制" : "复制报告链接"}
          </button>
          <Link href="/admin/essays" className="btn btn-sm">
            返回列表
          </Link>
        </div>
      </div>

      {!report ? (
        <div className="form-errors">报告数据损坏，无法展示评分明细（正文字段仍可取）。</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 16, alignItems: "start" }}>
          {/* 左：总分与四维 */}
          <div className="card">
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <div style={{ fontSize: 44, fontWeight: 800, lineHeight: 1 }}>{item.total}</div>
              <div style={{ color: "var(--muted)", fontSize: 12 }}>/ 100</div>
              <span className={`badge ${LEVEL_STYLE[item.level] ?? ""}`} style={{ marginLeft: "auto" }}>
                {item.level}
              </span>
            </div>

            <div style={{ marginTop: 18 }}>
              {DIM_ORDER.map((k) => {
                const max = item.dimMax[k];
                const v = item.dims[k];
                const pct = max > 0 ? Math.round((v / max) * 100) : 0;
                return (
                  <div key={k} style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
                      <span>{item.dimLabel[k]}</span>
                      <span style={{ color: "var(--muted)" }}>
                        {v} / {max}
                      </span>
                    </div>
                    <div style={{ height: 7, background: "#eef2f7", borderRadius: 999, marginTop: 5, overflow: "hidden" }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${pct}%`,
                          background: pct >= 80 ? "var(--ok)" : pct >= 60 ? "var(--primary)" : "var(--danger)",
                          borderRadius: 999,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ borderTop: "1px solid var(--border)", marginTop: 14, paddingTop: 12, fontSize: 12, color: "var(--muted)", lineHeight: 1.9 }}>
              <div>年级参考篇幅：{item.span[0]}—{item.span[1]} 字</div>
              <div>模型：{item.model}</div>
              <div>提交时间：{new Date(item.createdAt).toLocaleString("zh-CN", { hour12: false })}</div>
              <div style={{ wordBreak: "break-all" }}>编号：{item.id}</div>
              <div style={{ wordBreak: "break-all" }}>匿名设备：{item.anonId.slice(0, 12)}…</div>
            </div>
          </div>

          {/* 右：报告与原文 */}
          <div style={{ display: "grid", gap: 16 }}>
            <div className="card">
              <div className="sec-title">评测报告</div>
              {report.summary && (
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>{report.summary}</div>
              )}

              {report.highlights?.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 6 }}>写得好的地方</div>
                  {report.highlights.map((h, i) => (
                    <div key={i} className="box-tip" style={{ marginBottom: 8 }}>
                      <div style={{ fontWeight: 600 }}>「{h.quote}」</div>
                      <div style={{ marginTop: 3 }}>{h.why}</div>
                    </div>
                  ))}
                </div>
              )}

              {report.advice?.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 6 }}>改法建议</div>
                  {report.advice.map((a, i) => (
                    <div key={i} className="box-pit" style={{ marginBottom: 8 }}>
                      <div style={{ fontWeight: 600 }}>
                        {i + 1}. {a.issue}
                      </div>
                      <div style={{ marginTop: 3 }}>{a.how}</div>
                    </div>
                  ))}
                </div>
              )}

              {report.nextStep && (
                <div style={{ fontSize: 13 }}>
                  <span style={{ color: "var(--muted)" }}>下一步该练：</span>
                  {report.nextStep}
                </div>
              )}

              {report.flags && report.flags.length > 0 && (
                <div style={{ marginTop: 14, fontSize: 12, color: "var(--warn)" }}>
                  合规过滤命中：{report.flags.join("、")}（仅内部可见，家长看到的是中性表述）
                </div>
              )}
            </div>

            <div className="card">
              <div className="sec-title">作文原文</div>
              {item.title && (
                <div style={{ fontSize: 13, marginBottom: 8 }}>
                  <span style={{ color: "var(--muted)" }}>题目：</span>
                  {item.title}
                </div>
              )}

              {text === null ? (
                <div>
                  <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 10 }}>
                    正文为加密存储，默认不加载。仅在核对评分是否合理时查看。
                  </div>
                  <button className="btn btn-sm" onClick={showText} disabled={textLoading}>
                    {textLoading ? "读取中…" : "显示原文"}
                  </button>
                  {textError && <div className="form-errors" style={{ marginTop: 10 }}>{textError}</div>}
                </div>
              ) : (
                <div
                  style={{
                    whiteSpace: "pre-wrap",
                    fontSize: 14,
                    lineHeight: 1.9,
                    background: "#fbfcfe",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    padding: 14,
                  }}
                >
                  {text || "（正文无法解密：可能更换过 ZW_TEXT_KEY，或该条为降级记录）"}
                </div>
              )}
            </div>

            {publicUrl && (
              <div style={{ fontSize: 12, color: "var(--muted)", wordBreak: "break-all" }}>
                家长报告页：{publicUrl}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
