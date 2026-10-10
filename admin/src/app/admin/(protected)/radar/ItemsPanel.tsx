"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import {
  BUCKET_LABEL,
  CATEGORY_LABEL,
  FEE_LABEL,
  GRADE_LABEL,
  KEYDATE_LABEL,
  REGION_LABEL,
  ROLE_LABEL,
  WHITELIST_STATUS_LABEL,
} from "@/lib/radar/contract";
import { readApi } from "@/lib/radar/api-client";

/** 单条动作（update / publish / archive…）的响应 */
interface PatchResp {
  gateReasons?: string[];
  statusChanged?: string | null;
}

/** 手工新增的响应（hint 服务端恒返回，故为必填） */
interface CreateItemResp {
  hint: string;
  gatePassed: boolean;
  gateReasons: string[];
}

interface Edition {
  id: string;
  title: string;
  runDate: string;
  status: string;
  counts: { A: number; B: number; C: number; blocked: number; archived: number };
}

/** 白名单判定（信息标注，不参与门槛与打分） */
interface WhitelistInfo {
  status: string;
  statusLabel: string;
  scope?: string;
  matchedName?: string;
  matchedSeq?: number;
  group?: string;
  basis: string;
  manual: boolean;
  visible: boolean;
}

interface EventItem {
  id: string;
  name: string;
  organizer: string;
  coOrganizer?: string;
  audienceRaw: string;
  grades: string[];
  roles: string[];
  gradeLabel: string;
  roleLabel: string;
  category: string;
  categoryLabel: string;
  region: string;
  keyDate: string;
  keyDateType: string;
  keyDateTypeLabel: string;
  daysToKeyDate: number;
  timeRange?: string;
  location?: string;
  fee: string;
  feeLabel: string;
  signupMethod: string;
  sourceUrl: string;
  sourceName: string;
  sourceTier: number;
  notes?: string;
  siblings: { name: string; location?: string; signupMethod?: string; notes?: string }[];
  complianceNote: string;
  bucket: string;
  bucketLabel: string;
  totalScore: number;
  rScore: number;
  tScore: number;
  cScore: number;
  promoted: boolean;
  scoreOverridden: boolean;
  suggestedBucket: string;
  gatePassed: boolean;
  gateCodes: string[];
  status: string;
  archiveReason?: string;
  whitelist: WhitelistInfo;
}

const STATUS_LABEL: Record<string, string> = {
  draft: "草稿",
  published: "已发布",
  archived: "已下架",
  blocked: "未过门槛",
};

const STATUS_CLASS: Record<string, string> = {
  draft: "draft",
  published: "ok",
  archived: "bad",
  blocked: "bad",
};

type Draft = Partial<EventItem>;

/**
 * 条目维护面板：审、改、发、下架。
 *
 * 编辑保存后服务端会**重跑门槛**——把信源层级从 2 改成 4、把日期改到过去，
 * 都会立刻把该条打回 blocked，无法发布。
 */
export default function ItemsPanel({ refreshKey, onDone }: { refreshKey: number; onDone: () => void }) {
  const [editions, setEditions] = useState<Edition[]>([]);
  const [editionId, setEditionId] = useState("");
  const [items, setItems] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>({});
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadEditions = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/radar/editions");
      const list = await readApi<Edition[]>(res);
      setEditions(list);
      setEditionId((cur) => {
        if (cur && list.some((e) => e.id === cur)) return cur;
        const draftOne = list.find((e) => e.status === "draft");
        return (draftOne ?? list[0])?.id ?? "";
      });
      setErr("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "加载期次失败");
    }
  }, []);

  const loadItems = useCallback(async (id: string) => {
    if (!id) {
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/radar/events?editionId=${encodeURIComponent(id)}`);
      setItems(await readApi<EventItem[]>(res));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEditions();
  }, [loadEditions, refreshKey]);

  useEffect(() => {
    void loadItems(editionId);
  }, [editionId, loadItems, refreshKey]);

  const current = editions.find((e) => e.id === editionId);

  async function patch(id: string, body: Record<string, unknown>) {
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const res = await fetch(`/api/admin/radar/events/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await readApi<PatchResp>(res);
      if (data.gateReasons?.length) {
        setErr(`门槛未通过：${data.gateReasons.join("；")}${data.statusChanged ? `（状态 ${data.statusChanged}）` : ""}`);
      } else if (data.statusChanged) {
        setMsg(`状态已变更：${data.statusChanged}`);
      }
      await loadItems(editionId);
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "操作失败");
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(id: string) {
    await patch(id, { action: "update", ...draft });
    setEditingId(null);
    setDraft({});
  }

  async function createItem() {
    if (!editionId) {
      setErr("请先选择一个期次（可在「上传历史」中新建空期次）");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/admin/radar/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ editionId, ...draft }),
      });
      const data = await readApi<CreateItemResp>(res);
      setMsg(data.hint);
      if (!data.gatePassed && data.gateReasons?.length) {
        setErr(`该条未通过硬门槛：${data.gateReasons.join("；")}`);
      }
      setCreating(false);
      setDraft({});
      await loadItems(editionId);
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "新增失败");
    } finally {
      setBusy(false);
    }
  }

  async function archive(item: EventItem) {
    const reason = window.prompt(
      `下架「${item.name}」的原因（必填，将作为审计留痕）：\n例如：主办方要求撤下 / 信息有误 / 活动已结束`,
      "",
    );
    if (reason === null) return;
    if (!reason.trim()) {
      setErr("下架必须填写原因。");
      return;
    }
    await patch(item.id, { action: "archive", reason: reason.trim() });
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="filterbar" style={{ marginBottom: 0 }}>
          <span style={{ fontSize: 13, color: "var(--muted)" }}>期次</span>
          <select value={editionId} onChange={(e) => setEditionId(e.target.value)} style={{ minWidth: 280 }}>
            {editions.length === 0 && <option value="">（暂无期次，请先导入或新建）</option>}
            {editions.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title} · {STATUS_LABEL[e.status] ?? e.status} · 发布 {e.counts.A + e.counts.B + e.counts.C} 条
              </option>
            ))}
          </select>
          {current && (
            <span className={`badge ${STATUS_CLASS[current.status] ?? ""}`}>
              {STATUS_LABEL[current.status] ?? current.status}
            </span>
          )}
          {current && current.counts.blocked > 0 && (
            <span className="badge bad">未过门槛 {current.counts.blocked}</span>
          )}
          <div style={{ flex: 1 }} />
          <button
            className="btn"
            onClick={() => {
              setCreating((v) => !v);
              setDraft({ category: "english", region: "wuhan", fee: "free", sourceTier: 3, keyDateType: "signup_deadline" });
            }}
            disabled={!editionId}
          >
            {creating ? "取消手工新增" : "手工新增一条"}
          </button>
        </div>
      </div>

      {err && <div className="form-errors" style={{ marginBottom: 16 }}>{err}</div>}
      {msg && <div className="form-errors ok" style={{ marginBottom: 16 }}>{msg}</div>}

      {creating && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="sec-title">手工新增（仍受服务端硬门槛约束）</div>
          <ItemForm value={draft} onChange={setDraft} />
          <button className="btn primary" onClick={createItem} disabled={busy}>
            {busy ? "保存中…" : "保存并校验门槛"}
          </button>
        </div>
      )}

      {loading ? (
        <div className="empty">加载中…</div>
      ) : items.length === 0 ? (
        <div className="empty">该期次暂无条件。导入技能产出或在「上传历史」新建一个空白期次。</div>
      ) : (
        <table className="tbl">
          <thead>
            <tr>
              <th>活动 / 主办方</th>
              <th>对象</th>
              <th>关键节点</th>
              <th style={{ width: 70 }}>档位</th>
              <th style={{ width: 90 }}>状态</th>
              <th style={{ width: 260 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <Fragment key={it.id}>
                <tr key={it.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{it.name}</div>
                    <div style={{ color: "var(--muted)", fontSize: 12 }}>{it.organizer}</div>
                    {it.whitelist?.visible && (
                      <div style={{ marginTop: 3 }}>
                        <span
                          className={`badge ${it.whitelist.status === "confirmed" ? "ok" : "warn"}`}
                          title={it.whitelist.basis}
                        >
                          {it.whitelist.status === "confirmed"
                            ? `白名单 · 第 ${it.whitelist.matchedSeq ?? "?"} 项`
                            : "非名单内竞赛"}
                        </span>
                        {it.whitelist.manual && (
                          <span className="badge draft" style={{ marginLeft: 4 }} title="人工判定">
                            人工
                          </span>
                        )}
                      </div>
                    )}
                    {!it.gatePassed && (
                      <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 2 }}>
                        {it.gateCodes.join("；")}
                      </div>
                    )}
                    {it.status === "archived" && it.archiveReason && (
                      <div style={{ color: "var(--muted)", fontSize: 12 }}>下架原因：{it.archiveReason}</div>
                    )}
                  </td>
                  <td>
                    {it.gradeLabel}
                    <div style={{ color: "var(--muted)", fontSize: 12 }}>{it.roleLabel}</div>
                  </td>
                  <td>
                    {it.keyDateTypeLabel}
                    <div style={{ color: "var(--muted)", fontSize: 12 }}>
                      {it.keyDate}
                      {Number.isFinite(it.daysToKeyDate) && ` · 剩 ${it.daysToKeyDate} 天`}
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${it.bucket === "A" ? "ok" : it.bucket === "B" ? "warn" : "draft"}`}>
                      {it.bucketLabel}
                    </span>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{it.totalScore}</div>
                  </td>
                  <td>
                    <span className={`badge ${STATUS_CLASS[it.status] ?? ""}`}>
                      {STATUS_LABEL[it.status] ?? it.status}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions" style={{ flexWrap: "wrap" }}>
                      <button
                        className="btn sm"
                        onClick={() => {
                          setEditingId(editingId === it.id ? null : it.id);
                          setDraft(it);
                        }}
                      >
                        {editingId === it.id ? "收起" : "编辑"}
                      </button>
                      <select
                        className="btn sm"
                        style={{ padding: "4px 6px" }}
                        value={it.bucket}
                        onChange={(e) => patch(it.id, { action: "setBucket", bucket: e.target.value })}
                        disabled={busy || !it.gatePassed}
                        title="人工覆盖档位"
                      >
                        {Object.entries(BUCKET_LABEL).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                      {it.status !== "published" && (
                        <button
                          className="btn sm"
                          onClick={() => patch(it.id, { action: "publish" })}
                          disabled={busy || !it.gatePassed || it.status === "blocked"}
                          title={it.gatePassed ? "单独发布（需所属期次已发布）" : "未过门槛，不能发布"}
                        >
                          发布
                        </button>
                      )}
                      {it.status === "archived" ? (
                        <button className="btn sm" onClick={() => patch(it.id, { action: "restore" })} disabled={busy}>
                          恢复
                        </button>
                      ) : (
                        <button className="btn sm danger" onClick={() => archive(it)} disabled={busy}>
                          下架
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                {editingId === it.id && (
                  <tr key={`${it.id}-edit`}>
                    <td colSpan={6} style={{ background: "#fafafa" }}>
                      <WhitelistRow
                        item={it}
                        busy={busy}
                        onSet={(payload) => patch(it.id, { action: "setWhitelist", ...payload })}
                      />
                      <ItemForm value={draft} onChange={setDraft} />
                      <div className="row-actions">
                        <button className="btn primary" onClick={() => saveEdit(it.id)} disabled={busy}>
                          {busy ? "保存中…" : "保存（重跑门槛）"}
                        </button>
                        <button
                          className="btn"
                          onClick={() => {
                            setEditingId(null);
                            setDraft({});
                          }}
                        >
                          取消
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/**
 * 白名单判定的展示与人工修正。
 *
 * 内置名单只覆盖教育部的全国名单——省级备案名单等本地情形判不出来时，
 * 需要人工兜底。人工判定一经设置即留痕（whitelistManual），后续编辑不再
 * 自动覆盖，否则人工刚改完就会被下次保存冲掉。
 */
function WhitelistRow({
  item,
  busy,
  onSet,
}: {
  item: EventItem;
  busy: boolean;
  onSet: (payload: Record<string, unknown>) => void;
}) {
  const wl = item.whitelist;
  const tone = wl.status === "confirmed" ? "ok" : wl.status === "not_listed" ? "warn" : "draft";
  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 12, marginBottom: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
        白名单判定
        <span style={{ fontWeight: 400, color: "var(--muted)", fontSize: 12, marginLeft: 8 }}>
          不是门槛，但参与打分：判为名单内时可信度 C 分 +2.0（总分约 +0.5）
        </span>
      </div>
      <div style={{ fontSize: 13, marginBottom: 6, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span className={`badge ${tone}`}>{wl.statusLabel}</span>
        {wl.matchedName && (
          <span>
            {wl.matchedName}
            {wl.matchedSeq ? `（名单第 ${wl.matchedSeq} 项）` : ""}
          </span>
        )}
        {wl.manual && <span className="badge draft">人工判定</span>}
      </div>
      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10, lineHeight: 1.6 }}>
        依据：{wl.basis || "—"}
      </div>
      <div className="row-actions">
        <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
          人工修正
          <span style={{ color: "#b45309" }}>（只改标注，不重算分数）</span>
        </span>
        <select
          className="btn sm"
          style={{ padding: "4px 6px" }}
          value={wl.manual ? wl.status : ""}
          onChange={(e) => {
            const v = e.target.value;
            if (v) onSet({ whitelistStatus: v, whitelistBasis: `人工判定：${WHITELIST_STATUS_LABEL[v] ?? v}` });
          }}
          disabled={busy}
        >
          <option value="">（按名单自动判定）</option>
          {Object.entries(WHITELIST_STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        {wl.manual && (
          <button className="btn sm" onClick={() => onSet({ auto: true })} disabled={busy}>
            恢复自动判定
          </button>
        )}
      </div>
    </div>
  );
}

/** 编辑/新增共用的字段表单 */
function ItemForm({ value, onChange }: { value: Draft; onChange: (v: Draft) => void }) {
  const set = (k: keyof EventItem, v: unknown) => onChange({ ...value, [k]: v });
  const toggleIn = (k: "grades" | "roles", key: string) => {
    const cur = (value[k] as string[] | undefined) ?? [];
    set(k, cur.includes(key) ? cur.filter((x) => x !== key) : [...cur, key]);
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 12 }}>
      <label className="field" style={{ gridColumn: "span 2" }}>
        <span>活动名称 *</span>
        <input className="inp" value={value.name ?? ""} onChange={(e) => set("name", e.target.value)} />
      </label>
      <label className="field">
        <span>主办方 *</span>
        <input className="inp" value={value.organizer ?? ""} onChange={(e) => set("organizer", e.target.value)} />
      </label>

      <label className="field" style={{ gridColumn: "span 3" }}>
        <span>参赛对象原文 *</span>
        <input
          className="inp"
          value={value.audienceRaw ?? ""}
          onChange={(e) => set("audienceRaw", e.target.value)}
          placeholder="例如：全市小学 1—6 年级学生及指导教师"
        />
      </label>

      <div className="field">
        <span style={{ display: "block", fontSize: 12.5, color: "var(--muted)", marginBottom: 4 }}>学段 *</span>
        {Object.entries(GRADE_LABEL).map(([k, v]) => (
          <label key={k} style={{ display: "inline-flex", alignItems: "center", gap: 4, marginRight: 10, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={(value.grades ?? []).includes(k)}
              onChange={() => toggleIn("grades", k)}
            />
            {v}
          </label>
        ))}
      </div>
      <div className="field">
        <span style={{ display: "block", fontSize: 12.5, color: "var(--muted)", marginBottom: 4 }}>参与身份 *</span>
        {Object.entries(ROLE_LABEL).map(([k, v]) => (
          <label key={k} style={{ display: "inline-flex", alignItems: "center", gap: 4, marginRight: 10, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={(value.roles ?? []).includes(k)}
              onChange={() => toggleIn("roles", k)}
            />
            {v}
          </label>
        ))}
      </div>
      <label className="field">
        <span>类别 *</span>
        <select className="inp" value={value.category ?? "general"} onChange={(e) => set("category", e.target.value)}>
          {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>覆盖范围 *</span>
        <select className="inp" value={value.region ?? "wuhan"} onChange={(e) => set("region", e.target.value)}>
          {Object.entries(REGION_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>关键节点日期 *</span>
        <input
          className="inp"
          type="date"
          value={value.keyDate ?? ""}
          onChange={(e) => set("keyDate", e.target.value)}
        />
      </label>
      <label className="field">
        <span>节点类型 *</span>
        <select
          className="inp"
          value={value.keyDateType ?? "signup_deadline"}
          onChange={(e) => set("keyDateType", e.target.value)}
        >
          {Object.entries(KEYDATE_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>活动时间（可空）</span>
        <input className="inp" value={value.timeRange ?? ""} onChange={(e) => set("timeRange", e.target.value)} />
      </label>
      <label className="field">
        <span>地点（可空）</span>
        <input className="inp" value={value.location ?? ""} onChange={(e) => set("location", e.target.value)} />
      </label>
      <label className="field">
        <span>费用 *</span>
        <select className="inp" value={value.fee ?? "unknown"} onChange={(e) => set("fee", e.target.value)}>
          {Object.entries(FEE_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>

      <label className="field" style={{ gridColumn: "span 2" }}>
        <span>报名方式 *（只写客观入口，不得写「代报名 / 组织报名」）</span>
        <input
          className="inp"
          value={value.signupMethod ?? ""}
          onChange={(e) => set("signupMethod", e.target.value)}
          placeholder="例如：由学校统一提交至官方平台 basic.hubei.smartedu.cn"
        />
      </label>
      <label className="field">
        <span>信源层级 *（≤3 才可发布）</span>
        <select
          className="inp"
          value={value.sourceTier ?? 3}
          onChange={(e) => set("sourceTier", Number(e.target.value))}
        >
          <option value={1}>1 · 官方红头文件</option>
          <option value={2}>2 · 主办方官网 / 官方公众号</option>
          <option value={3}>3 · 权威媒体</option>
          <option value={4}>4 · 自媒体 / 群转发（不可发布）</option>
        </select>
      </label>

      <label className="field" style={{ gridColumn: "span 2" }}>
        <span>信息来源链接 *</span>
        <input className="inp" value={value.sourceUrl ?? ""} onChange={(e) => set("sourceUrl", e.target.value)} />
      </label>
      <label className="field">
        <span>来源名称 *</span>
        <input className="inp" value={value.sourceName ?? ""} onChange={(e) => set("sourceName", e.target.value)} />
      </label>

      <label className="field" style={{ gridColumn: "span 3" }}>
        <span>备注（对外展示，注意话术红线）</span>
        <textarea className="inp" value={value.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
      </label>
    </div>
  );
}
