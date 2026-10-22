"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { readApi } from "@/lib/read-api";
import type { SpeakingDevice, SpeakingMode } from "@/lib/h5/client";

/**
 * 服务 · 英语测评额度
 *
 * 场景与「设备额度」（作文测评）一致：家长加了企微，要给他多放几次。
 * 做法也一样：让家长看测评页底部的「本机识别码」（如 N7F-DQH），念给你，
 * 在这里按码搜到那台设备，改完保存即时生效。
 *
 * 与作文测评是**两套独立数据**：同一个家长两个工具都用得上，但 H5 与 zuowen
 * 各发各的 Cookie、各记各的账。识别码长得像但互不通用，别串着查。
 */

type ListResponse = {
  configured?: boolean;
  items: SpeakingDevice[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  defaults?: { dailyLimit: number; totalCap: number; enforce: boolean } | null;
  today?: { total: number; distinctDevices: number } | null;
  error?: string;
  hint?: string;
};

type Draft = { limitEnabled: boolean; customLimit: string; note: string };

const MODE_BADGE: Record<SpeakingMode, { cls: string; text: string }> = {
  default: { cls: "draft", text: "默认" },
  custom: { cls: "ok", text: "自定义" },
  unlimited: { cls: "warn", text: "不限次数" },
};

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 三态 → 表格里那两个控件的初始值（default 一律留空，让占位符显示默认次数）。 */
function draftOf(it: SpeakingDevice): Draft {
  return {
    limitEnabled: it.mode !== "unlimited",
    customLimit: it.mode === "custom" && it.customLimit ? String(it.customLimit) : "",
    note: it.note ?? "",
  };
}

export default function SpeakingPage() {
  const [q, setQ] = useState("");
  const [applied, setApplied] = useState("");
  const [page, setPage] = useState(1);

  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hint, setHint] = useState("");

  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [flash, setFlash] = useState("");
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const say = useCallback((msg: string) => {
    setFlash(msg);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(""), 2600);
  }, []);

  const load = useCallback(async (p: number, query: string) => {
    setLoading(true);
    setError("");
    setHint("");
    try {
      const res = await fetch(`/api/admin/speaking?page=${p}&q=${encodeURIComponent(query)}`, {
        cache: "no-store",
      });
      const d = await readApi<ListResponse>(res);
      setData(d);
      if (d.error) {
        setError(d.error);
        setHint(d.hint || "");
      }
      const next: Record<string, Draft> = {};
      for (const it of d.items || []) next[it.code] = draftOf(it);
      setDrafts(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // 支持从别处带 ?q=识别码 跳进来，直接查那台设备
  useEffect(() => {
    const q0 = new URLSearchParams(window.location.search).get("q");
    if (q0) {
      setQ(q0);
      setApplied(q0);
    }
  }, []);

  useEffect(() => {
    load(page, applied);
  }, [load, page, applied]);

  useEffect(
    () => () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    },
    [],
  );

  const patchDraft = (code: string, part: Partial<Draft>) => {
    setDrafts((prev) => ({ ...prev, [code]: { ...prev[code], ...part } }));
  };

  const save = async (it: SpeakingDevice, override?: Partial<Draft>) => {
    const base = drafts[it.code];
    if (!base) return;
    const d: Draft = { ...base, ...(override ?? {}) };
    const rawLimit = d.customLimit.trim();
    const customLimit = rawLimit === "" ? null : Number(rawLimit);

    if (customLimit !== null && (!Number.isInteger(customLimit) || customLimit < 1 || customLimit > 200)) {
      setError("每日次数需为 1—200 的整数，留空表示沿用默认值");
      return;
    }

    // 三态由这两个控件推导，不让老板再理解一遍「limitMode 是什么」
    const body: { limitMode: SpeakingMode; customLimit?: number | null; note: string } = d.limitEnabled
      ? customLimit === null
        ? { limitMode: "default", note: d.note.trim() }
        : { limitMode: "custom", customLimit, note: d.note.trim() }
      : { limitMode: "unlimited", note: d.note.trim() };

    setSaving(it.code);
    setError("");
    try {
      const res = await fetch(`/api/admin/speaking/${encodeURIComponent(it.code)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await readApi<{ item: SpeakingDevice }>(res);
      setData((prev) =>
        prev ? { ...prev, items: prev.items.map((x) => (x.code === j.item.code ? j.item : x)) } : prev,
      );
      setDrafts((prev) => ({ ...prev, [j.item.code]: draftOf(j.item) }));
      say(`${j.item.code} 已保存`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(null);
    }
  };

  const resetRow = (it: SpeakingDevice) => {
    patchDraft(it.code, { limitEnabled: true, customLimit: "" });
    void save(it, { limitEnabled: true, customLimit: "" });
  };

  const items = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;
  const notConfigured = data && data.configured === false;
  const defaults = data?.defaults ?? null;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>英语测评额度</h1>
          <div className="desc">
            家长加了企微要放开次数时用这里。按识别码搜到那台设备，改完保存即生效。
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14, fontSize: 13, lineHeight: 1.9 }}>
        <div className="sec-title">怎么用</div>
        <div style={{ color: "var(--muted)" }}>
          1. 家长打开英语测评页（h5 域名），首页底部与结果页底部都有一行 <b>本机识别码 N7F-DQH</b>，
          让他念给你或截图发你。
          <br />
          2. 在下面搜索框输入这个码（横杠可省），找到那台设备。
          <br />
          3. 关掉「限制」= 当天不限次数；或保持限制、把次数改成你要的数字（留空 = 沿用默认{" "}
          {defaults?.dailyLimit ?? 2} 次）。
        </div>
        <div style={{ marginTop: 8, color: "var(--muted)", fontSize: 12.5 }}>
          {defaults
            ? `当前默认：每台设备每天 ${defaults.dailyLimit} 次；全站每天上限 ${defaults.totalCap} 次，今日已用 ${
                data?.today?.total ?? 0
              } 次、${data?.today?.distinctDevices ?? 0} 台设备。放开个人次数不会绕过全站上限（那是防刷爆账单的硬顶）。`
            : "—"}
        </div>
        {defaults && !defaults.enforce && (
          <div style={{ marginTop: 6, color: "var(--warn)", fontSize: 12.5 }}>
            注意：H5 的 H5_QUOTA_ENFORCE=0，当前只记账不拦截，这里改什么都不会生效。
          </div>
        )}
        <div style={{ marginTop: 6, color: "var(--warn)", fontSize: 12.5 }}>
          提醒：设备按浏览器区分。家长换手机、换浏览器或清缓存，识别码会变，需要重新开一次。
        </div>
        <div style={{ marginTop: 6, color: "var(--muted)", fontSize: 12.5 }}>
          这套码与「设备额度」（作文测评）互不通用：同一个家长两个工具都用的话，会各有一个码。
        </div>
      </div>

      {notConfigured && (
        <div className="form-errors" style={{ marginBottom: 16 }}>
          英语测评服务未接通：{hint || data?.hint || "请检查 admin 的 H5_BASE_URL / H5_INTERNAL_TOKEN"}
        </div>
      )}

      {error && (
        <div className="form-errors" style={{ marginBottom: 14 }}>
          {error}
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="filterbar">
          <input
            placeholder="搜索识别码或备注"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setPage(1);
                setApplied(q.trim());
              }
            }}
            style={{ minWidth: 220 }}
          />
          <button
            className="btn btn-sm primary"
            onClick={() => {
              setPage(1);
              setApplied(q.trim());
            }}
          >
            查询
          </button>
          <button
            className="btn btn-sm"
            onClick={() => {
              setQ("");
              setApplied("");
              setPage(1);
            }}
          >
            重置
          </button>
          {flash && (
            <span style={{ marginLeft: "auto", color: "var(--ok)", fontSize: 13 }}>{flash}</span>
          )}
        </div>
      </div>

      <table className="tbl">
        <thead>
          <tr>
            <th style={{ width: 108 }}>识别码</th>
            <th style={{ width: 160 }}>备注</th>
            <th style={{ width: 92 }}>今日 / 累计</th>
            <th style={{ width: 104 }}>最后使用</th>
            <th style={{ width: 128 }}>当前额度</th>
            <th style={{ width: 240 }}>调整</th>
            <th style={{ width: 148 }}>操作</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={7} style={{ textAlign: "center", color: "var(--muted)", padding: 24 }}>
                加载中…
              </td>
            </tr>
          ) : items.length === 0 ? (
            <tr>
              <td colSpan={7} style={{ textAlign: "center", color: "var(--muted)", padding: 24 }}>
                {notConfigured
                  ? "服务未接通，暂无数据"
                  : applied
                    ? "没有匹配的设备，核对一下识别码（没有 0、1、O、I、L）"
                    : "还没有设备记录。家长打开过一次测评页就会出现在这里"}
              </td>
            </tr>
          ) : (
            items.map((it) => {
              const d = drafts[it.code] ?? draftOf(it);
              const badge = MODE_BADGE[it.mode] ?? MODE_BADGE.default;
              return (
                <tr key={it.code}>
                  <td>
                    <b style={{ fontFamily: "ui-monospace, Menlo, monospace", letterSpacing: "0.06em" }}>
                      {it.code}
                    </b>
                  </td>
                  <td>
                    <input
                      className="inp"
                      style={{ width: "100%", padding: "5px 8px", fontSize: 12.5 }}
                      placeholder="备注"
                      maxLength={40}
                      value={d.note}
                      onChange={(e) => patchDraft(it.code, { note: e.target.value })}
                    />
                  </td>
                  <td>
                    {it.today} / {it.total}
                  </td>
                  <td style={{ color: "var(--muted)", fontSize: 12.5 }}>{fmtTime(it.lastAt)}</td>
                  <td>
                    <span className={`badge ${badge.cls}`}>{badge.text}</span>
                    <span style={{ marginLeft: 6, color: "var(--muted)", fontSize: 12 }}>
                      {it.mode === "unlimited"
                        ? "" // badge 已经写明「不限次数」，再补一句就是重复
                        : it.mode === "custom" && it.limit
                          ? `${it.limit} 次/天`
                          : `${defaults?.dailyLimit ?? 2} 次/天`}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
                      <label style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5 }}>
                        <input
                          type="checkbox"
                          checked={d.limitEnabled}
                          onChange={(e) => patchDraft(it.code, { limitEnabled: e.target.checked })}
                        />
                        限制
                      </label>
                      <input
                        className="inp"
                        type="number"
                        min={1}
                        max={200}
                        placeholder="默认"
                        disabled={!d.limitEnabled}
                        value={d.customLimit}
                        onChange={(e) => patchDraft(it.code, { customLimit: e.target.value })}
                        style={{ width: 68, padding: "5px 8px", fontSize: 12.5 }}
                      />
                      <span style={{ color: "var(--muted)", fontSize: 12 }}>次/天</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        className="btn btn-sm primary"
                        disabled={saving === it.code}
                        onClick={() => void save(it)}
                        style={{ whiteSpace: "nowrap" }}
                      >
                        {saving === it.code ? "保存中" : "保存"}
                      </button>
                      <button
                        className="btn btn-sm"
                        disabled={saving === it.code}
                        onClick={() => resetRow(it)}
                        style={{ whiteSpace: "nowrap" }}
                      >
                        默认
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      <div className="pager">
        <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          上一页
        </button>
        <span style={{ color: "var(--muted)", fontSize: 13 }}>
          第 {page} / {totalPages} 页 · 共 {data?.total ?? 0} 台
        </span>
        <button
          className="btn btn-sm"
          disabled={page >= totalPages}
          onClick={() => setPage((p) => p + 1)}
        >
          下一页
        </button>
      </div>

      <div style={{ marginTop: 18, color: "var(--muted)", fontSize: 12, lineHeight: 1.8 }}>
        设备身份来自浏览器里的匿名 Cookie，与家长真实身份无关；备注栏只写给内部看的标签，
        不要填手机号、微信号或孩子姓名。每一次调整都会记在 admin 的服务端日志里（操作人 + 设备码 + 改动内容）。
      </div>
    </>
  );
}
