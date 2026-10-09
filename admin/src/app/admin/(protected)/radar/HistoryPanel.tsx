"use client";

import { useCallback, useEffect, useState } from "react";
import { readApi } from "@/lib/radar/api-client";

interface Edition {
  id: string;
  runDate: string;
  windowStart: string;
  windowEnd: string;
  title: string;
  status: string;
  fileName?: string;
  fileHash?: string;
  schemaVersion?: string;
  totalCount: number;
  acceptedCount: number;
  blockedCount: number;
  counts: { A: number; B: number; C: number; blocked: number; archived: number };
  publishedAt?: string;
  note?: string;
  createdAt: string;
}

/** 期次级动作（publish / rollback）的响应 */
interface ActResp {
  published?: number;
  rolledBack?: number;
  autoArchived?: { name: string; reason: string }[];
}

interface CreateEditionResp {
  title: string;
}

const STATUS_LABEL: Record<string, string> = {
  draft: "草稿（未发布）",
  published: "已发布（对外展示中）",
  hidden: "已下线",
  rolled_back: "已回滚",
};

const STATUS_CLASS: Record<string, string> = {
  draft: "draft",
  published: "ok",
  hidden: "warn",
  rolled_back: "bad",
};

/**
 * 上传历史面板：批次留痕 + 整期发布 / 下线 / 回滚。
 *
 * 回滚为什么必须有：技能侧某次检索出错（例如把培训机构自办赛事混进来、
 * 或日期全填错）时，整批撤销远比逐条下架可靠。回滚会释放文件指纹，
 * 允许修正后重新导入同一份文件。
 */
export default function HistoryPanel({ refreshKey, onDone }: { refreshKey: number; onDone: () => void }) {
  const [list, setList] = useState<Edition[]>([]);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [note, setNote] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/radar/editions");
      setList(await readApi<Edition[]>(res));
      setErr("");
    } catch (e) {
      // 不再吞掉原因：区分「数据库缺表」「未登录」「网关挂了」对运维是第一手线索
      setErr(e instanceof Error ? e.message : "加载期次列表失败");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  async function act(id: string, action: string, extra: Record<string, unknown> = {}) {
    setBusy(`${id}:${action}`);
    setErr("");
    setMsg("");
    try {
      const res = await fetch(`/api/admin/radar/editions/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, note, ...extra }),
      });
      const data = await readApi<ActResp>(res);
      if (action === "publish") {
        const auto = (data.autoArchived ?? []) as { name: string; reason: string }[];
        setMsg(
          `已发布 ${data.published} 条。` +
            (auto.length
              ? `其中 ${auto.length} 条复查未通过被自动归档：${auto.map((a) => `${a.name}（${a.reason}）`).join("；")}`
              : ""),
        );
      } else if (action === "rollback") {
        setMsg(`已回滚：${data.rolledBack} 条转为下架状态，文件指纹已释放。`);
      } else {
        setMsg("操作完成。");
      }
      await load();
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "操作失败");
    } finally {
      setBusy("");
    }
  }

  async function createEdition() {
    setBusy("create");
    setErr("");
    setMsg("");
    try {
      const res = await fetch("/api/admin/radar/editions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ runDate: newDate, windowStart: newStart, windowEnd: newEnd }),
      });
      const data = await readApi<CreateEditionResp>(res);
      setMsg(`已新建空白期次「${data.title}」，可到「条目维护」手工录入。`);
      setNewDate("");
      setNewStart("");
      setNewEnd("");
      await load();
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "新建失败");
    } finally {
      setBusy("");
    }
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="sec-title">新建空白期次（技能未产出时手工开工）</div>
        <div className="filterbar" style={{ marginBottom: 0 }}>
          <label style={{ fontSize: 13, color: "var(--muted)" }}>
            运行日
            <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} style={{ marginLeft: 8 }} />
          </label>
          <label style={{ fontSize: 13, color: "var(--muted)" }}>
            窗口起
            <input type="date" value={newStart} onChange={(e) => setNewStart(e.target.value)} style={{ marginLeft: 8 }} />
          </label>
          <label style={{ fontSize: 13, color: "var(--muted)" }}>
            窗口止
            <input type="date" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} style={{ marginLeft: 8 }} />
          </label>
          <button className="btn" onClick={createEdition} disabled={busy === "create"}>
            {busy === "create" ? "创建中…" : "新建期次"}
          </button>
        </div>
      </div>

      {err && <div className="form-errors" style={{ marginBottom: 16 }}>{err}</div>}
      {msg && <div className="form-errors ok" style={{ marginBottom: 16 }}>{msg}</div>}

      <div className="card" style={{ marginBottom: 16 }}>
        <label className="field" style={{ marginBottom: 0 }}>
          <span>操作备注（下架 / 回滚时建议填写，将写入审计留痕）</span>
          <input className="inp" value={note} onChange={(e) => setNote(e.target.value)} placeholder="例如：本期检索包含培训机构自办赛事，整批回滚" />
        </label>
      </div>

      {list.length === 0 ? (
        <div className="empty">还没有任何期次。到「导入新一期」上传技能产出，或在上方新建空白期次。</div>
      ) : (
        <table className="tbl">
          <thead>
            <tr>
              <th>期次</th>
              <th>导入来源</th>
              <th>通过 / 拦截</th>
              <th>发布构成</th>
              <th>状态</th>
              <th style={{ width: 220 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {list.map((e) => (
              <tr key={e.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>{e.title}</div>
                  <div style={{ color: "var(--muted)", fontSize: 12 }}>
                    运行日 {e.runDate} · 窗口 {e.windowStart} ~ {e.windowEnd}
                  </div>
                  {e.note && <div style={{ color: "var(--muted)", fontSize: 12 }}>备注：{e.note}</div>}
                </td>
                <td>
                  {e.fileName ? (
                    <div style={{ fontSize: 12.5 }}>
                      {e.fileName}
                      <div style={{ color: "var(--muted)", fontSize: 11.5 }}>
                        {e.schemaVersion ? `契约 ${e.schemaVersion} · ` : ""}
                        {e.createdAt.slice(0, 16).replace("T", " ")}
                      </div>
                    </div>
                  ) : (
                    <span className="badge">手工期次</span>
                  )}
                </td>
                <td>
                  <span style={{ color: "var(--ok)", fontWeight: 600 }}>{e.acceptedCount}</span>
                  {e.blockedCount > 0 && (
                    <span style={{ color: "var(--danger)" }}> / {e.blockedCount}</span>
                  )}
                  <div style={{ color: "var(--muted)", fontSize: 12 }}>共解析 {e.totalCount} 条</div>
                </td>
                <td>
                  <span className="badge ok">主推 {e.counts.A}</span>{" "}
                  <span className="badge warn">备选 {e.counts.B}</span>{" "}
                  <span className="badge">简讯 {e.counts.C}</span>
                  {e.counts.archived > 0 && (
                    <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 2 }}>
                      已下架 {e.counts.archived}
                    </div>
                  )}
                </td>
                <td>
                  <span className={`badge ${STATUS_CLASS[e.status] ?? ""}`}>
                    {STATUS_LABEL[e.status] ?? e.status}
                  </span>
                  {e.publishedAt && (
                    <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 2 }}>
                      {e.publishedAt.slice(0, 16).replace("T", " ")}
                    </div>
                  )}
                </td>
                <td>
                  <div className="row-actions" style={{ flexWrap: "wrap" }}>
                    {e.status !== "published" && e.status !== "rolled_back" && (
                      <button
                        className="btn sm primary"
                        onClick={() => act(e.id, "publish")}
                        disabled={!!busy}
                        title="按发布日复查门槛后整期上线，并下线其它已发布期次"
                      >
                        {busy === `${e.id}:publish` ? "发布中…" : "发布整期"}
                      </button>
                    )}
                    {e.status === "published" && (
                      <button className="btn sm" onClick={() => act(e.id, "hide")} disabled={!!busy}>
                        下线整期
                      </button>
                    )}
                    {e.status !== "rolled_back" && (
                      <button
                        className="btn sm danger"
                        onClick={() => {
                          if (window.confirm(`确认回滚「${e.title}」？该批次的全部条目将转为下架状态（不物理删除）。`)) {
                            void act(e.id, "rollback");
                          }
                        }}
                        disabled={!!busy}
                      >
                        回滚批次
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
