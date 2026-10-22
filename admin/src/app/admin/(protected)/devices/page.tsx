"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { readApi } from "@/lib/read-api";
import type { DeviceItem, DeviceMode } from "@/lib/zuowen/client";

/**
 * 服务 · 设备额度
 *
 * 场景：家长加了企微，要给他多放几次。
 * 做法：让他看测评页页脚那行「本机识别码」（如 NUS-7QD），念给你，
 * 在这里按码搜到那台设备，把开关关掉或把次数调大，保存即生效。
 *
 * 为什么不是「按手机号给额度」：zuowen 全程匿名，库里没有、也不该有家长身份信息。
 * 代价是家长换了手机或清了缓存就得重新开一次 —— 这是匿名方案绕不开的，
 * 但换来的是「孩子作文库里没有任何可识别身份的信息」。
 */

type ListResponse = {
  configured?: boolean;
  items: DeviceItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  synced?: number;
  defaults?: { dailyLimit: number; globalCap: number; globalUsed: number } | null;
  error?: string;
  hint?: string;
};

type Draft = { limitEnabled: boolean; customLimit: string; note: string };

const MODE_BADGE: Record<DeviceMode, { cls: string; text: string }> = {
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

export default function DevicesPage() {
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
      const res = await fetch(
        `/api/admin/devices?page=${p}&q=${encodeURIComponent(query)}`,
        { cache: "no-store" },
      );
      const d = await readApi<ListResponse>(res);
      setData(d);
      if (d.error) {
        setError(d.error);
        setHint(d.hint || "");
      }
      const next: Record<string, Draft> = {};
      for (const it of d.items || []) {
        next[it.code] = {
          limitEnabled: it.limitEnabled,
          customLimit: it.customLimit === null ? "" : String(it.customLimit),
          note: it.note ?? "",
        };
      }
      setDrafts(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // 从作文详情页点设备码跳过来时带着 ?q=CODE，直接按该码查一次
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

  useEffect(() => () => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
  }, []);

  const patchDraft = (code: string, part: Partial<Draft>) => {
    setDrafts((prev) => ({ ...prev, [code]: { ...prev[code], ...part } }));
  };

  const save = async (it: DeviceItem, override?: Partial<Draft>) => {
    const base = drafts[it.code];
    if (!base) return;
    const d: Draft = { ...base, ...(override ?? {}) };
    const rawLimit = d.customLimit.trim();
    const customLimit = rawLimit === "" ? null : Number(rawLimit);

    if (customLimit !== null && (!Number.isInteger(customLimit) || customLimit < 1 || customLimit > 200)) {
      setError("每日次数需为 1—200 的整数，留空表示沿用默认值");
      return;
    }

    setSaving(it.code);
    setError("");
    try {
      const res = await fetch(`/api/admin/devices/${it.code}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          limitEnabled: d.limitEnabled,
          customLimit,
          note: d.note.trim(),
        }),
      });
      const j = await readApi<{ item: DeviceItem }>(res);
      setData((prev) =>
        prev
          ? { ...prev, items: prev.items.map((x) => (x.code === j.item.code ? j.item : x)) }
          : prev,
      );
      setDrafts((prev) => ({
        ...prev,
        [j.item.code]: {
          limitEnabled: j.item.limitEnabled,
          customLimit: j.item.customLimit === null ? "" : String(j.item.customLimit),
          note: j.item.note ?? "",
        },
      }));
      say(`${j.item.display} 已保存`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(null);
    }
  };

  const resetRow = (it: DeviceItem) => {
    patchDraft(it.code, { limitEnabled: true, customLimit: "" });
    void save(it, { limitEnabled: true, customLimit: "" });
  };

  const items = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;
  const notConfigured = data && data.configured === false;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>设备额度</h1>
          <div className="desc">
            家长加了企微要放开次数时用这里。按识别码搜到那台设备，改完保存即生效。
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14, fontSize: 13, lineHeight: 1.9 }}>
        <div className="sec-title">怎么用</div>
        <div style={{ color: "var(--muted)" }}>
          1. 家长打开测评页（zuowen 域名），页脚有一行 <b>本机识别码 ABC-DEF</b>，让他念给你或截图发你。
          <br />
          2. 在下面搜索框输入这个码，找到那台设备。
          <br />
          3. 关掉「限制」= 当天不限次数；或保持限制、把次数改成你要的数字（留空 = 沿用默认{" "}
          {data?.defaults?.dailyLimit ?? 3} 次）。
        </div>
        <div style={{ marginTop: 8, color: "var(--muted)", fontSize: 12.5 }}>
          {data?.defaults
            ? `当前默认：每台设备每天 ${data.defaults.dailyLimit} 次；全站每天上限 ${data.defaults.globalCap} 条，今日已用 ${data.defaults.globalUsed} 条。放开个人次数不会绕过全站上限（那是防刷爆账单的硬顶）。`
            : "—"}
        </div>
        <div style={{ marginTop: 6, color: "var(--warn)", fontSize: 12.5 }}>
          提醒：设备是按浏览器区分的。家长换手机、换浏览器或清了缓存，识别码会变，需要重新开一次。
        </div>
      </div>

      {notConfigured && (
        <div className="form-errors" style={{ marginBottom: 16 }}>
          作文测评服务未接通：{hint || data?.hint || "请检查 admin 的 ZUOWEN_BASE_URL / ZUOWEN_CRON_TOKEN"}
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
          {data?.synced ? (
            <span style={{ color: "var(--muted)", fontSize: 12.5 }}>
              已为 {data.synced} 台历史设备补上识别码
            </span>
          ) : null}
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
              const d = drafts[it.code] ?? {
                limitEnabled: it.limitEnabled,
                customLimit: it.customLimit === null ? "" : String(it.customLimit),
                note: it.note ?? "",
              };
              const badge = MODE_BADGE[it.mode];
              return (
                <tr key={it.code}>
                  <td>
                    <b style={{ fontFamily: "ui-monospace, Menlo, monospace", letterSpacing: "0.06em" }}>
                      {it.display}
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
                        ? "不限"
                        : it.customLimit
                          ? `${it.customLimit} 次/天`
                          : `${data?.defaults?.dailyLimit ?? 3} 次/天`}
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
        不要填手机号、微信号或孩子姓名。每一次调整都会记在服务端日志里（操作人 + 设备码 + 改动内容）。
      </div>
    </>
  );
}
