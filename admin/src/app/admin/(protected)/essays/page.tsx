"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { readApi } from "@/lib/read-api";
import type { EssayListItem, EssayStats } from "@/lib/zuowen/client";

/**
 * 作文测评 · 提交列表
 *
 * 只读。这里刻意不提供「删除」：
 * 家长手里的报告链接（zuowen/r/<id>）是长期有效的，后台删一条就等于让某个家庭
 * 刚收到的报告变成 404，而且无法向家长解释。要控制留存，走 zuowen 侧的按天清理策略，
 * 不要在这里做单条删除。
 */

const GRADE_OPTIONS = [1, 2, 3, 4, 5, 6];

const LEVEL_STYLE: Record<string, string> = {
  优秀: "ok",
  良好: "",
  合格: "warn",
  待提升: "bad",
};

const SCORE_BANDS = [
  { key: "", label: "全部分数", min: "", max: "" },
  { key: "a", label: "85 分以上", min: "85", max: "" },
  { key: "b", label: "70—84 分", min: "70", max: "84" },
  { key: "c", label: "60—69 分", min: "60", max: "69" },
  { key: "d", label: "60 分以下", min: "", max: "59" },
];

const RANGE_OPTIONS = [
  { key: "", label: "全部时间", days: "" },
  { key: "1", label: "今天", days: "1" },
  { key: "7", label: "近 7 天", days: "7" },
  { key: "30", label: "近 30 天", days: "30" },
];

type Payload = {
  configured: boolean;
  items: EssayListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  stats: EssayStats | null;
  hint?: string;
};

function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("zh-CN", { hour12: false });
}

export default function EssaysPage() {
  const [items, setItems] = useState<EssayListItem[]>([]);
  const [stats, setStats] = useState<EssayStats | null>(null);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);

  const [grade, setGrade] = useState("");
  const [level, setLevel] = useState("");
  const [source, setSource] = useState("");
  const [range, setRange] = useState("");
  const [band, setBand] = useState("");
  const [q, setQ] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notConfigured, setNotConfigured] = useState("");

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (grade) p.set("grade", grade);
    if (level) p.set("level", level);
    if (source) p.set("source", source);
    if (q.trim()) p.set("q", q.trim());
    const r = RANGE_OPTIONS.find((x) => x.key === range);
    if (r?.days) p.set("days", r.days);
    const b = SCORE_BANDS.find((x) => x.key === band);
    if (b?.min) p.set("min", b.min);
    if (b?.max) p.set("max", b.max);
    return p;
  }, [grade, level, source, range, band, q]);

  const load = useCallback(
    async (targetPage: number) => {
      setLoading(true);
      setError("");
      try {
        const p = new URLSearchParams(query);
        p.set("page", String(targetPage));
        const data = await readApi<Payload>(await fetch(`/api/admin/essays?${p.toString()}`));
        if (!data.configured) {
          setNotConfigured(data.hint || "作文测评服务未配置");
          setItems([]);
          setTotal(0);
          setTotalPages(1);
          setStats(null);
          return;
        }
        setNotConfigured("");
        setItems(data.items || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
        setStats(data.stats ?? null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "加载失败");
      } finally {
        setLoading(false);
      }
    },
    [query],
  );

  useEffect(() => {
    load(page);
  }, [load, page]);

  const applyFilter = () => {
    if (page === 1) load(1);
    else setPage(1); // page 变化会触发上面的 effect
  };

  const reset = () => {
    setGrade("");
    setLevel("");
    setSource("");
    setRange("");
    setBand("");
    setQ("");
    setPage(1);
  };

  const exportUrl = `/api/admin/essays/export?${query.toString()}`;
  const levelTotal = stats ? stats.byLevel.reduce((s, x) => s + x.count, 0) : 0;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>作文测评</h1>
          <div className="desc">
            「树蕙伴学」服务号「写作水平测评」菜单的家长提交记录，共 {total} 篇
          </div>
        </div>
      </div>

      {notConfigured && (
        <div className="form-errors" style={{ marginBottom: 16 }}>
          作文测评服务未接通：{notConfigured}
        </div>
      )}

      {error && <div className="form-errors">{error}</div>}

      {/* 统计卡片：基于全量数据，不随筛选变化 */}
      <div className="grid cols-4" style={{ marginBottom: 14 }}>
        <div className="card stat">
          <div className="label">累计提交</div>
          <div className="num">{stats?.total ?? "—"}</div>
          <div className="hint">
            {stats ? `文字 ${stats.bySource.find((s) => s.source === "text")?.count ?? 0} · 图片 ${stats.bySource.find((s) => s.source === "image")?.count ?? 0}` : "—"}
          </div>
        </div>
        <div className="card stat">
          <div className="label">今日（北京时间）</div>
          <div className="num">{stats?.today ?? "—"}</div>
          <div className="hint">近 7 天 {stats?.last7 ?? "—"} 篇</div>
        </div>
        <div className="card stat">
          <div className="label">平均分</div>
          <div className="num">{stats?.avgScore ?? "—"}</div>
          <div className="hint">满分 100，四维相加</div>
        </div>
        <div className="card stat">
          <div className="label">等级分布</div>
          <div className="num" style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.9 }}>
            {stats
              ? stats.byLevel.map((x) => (
                  <span key={x.level} style={{ marginRight: 10, whiteSpace: "nowrap" }}>
                    {x.level} <b>{x.count}</b>
                  </span>
                ))
              : "—"}
          </div>
          <div className="hint">共 {levelTotal} 篇已评级</div>
        </div>
      </div>

      {/* 年级分布：用横条看趋势，比数字串直观 */}
      {stats && stats.total > 0 && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="sec-title">年级分布</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12 }}>
            {stats.byGrade.map((g) => {
              const max = Math.max(...stats.byGrade.map((x) => x.count), 1);
              return (
                <div key={g.grade}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
                    <span>{g.label}</span>
                    <span style={{ color: "var(--muted)" }}>
                      {g.count} 篇{g.avg !== null ? ` · 均 ${g.avg}` : ""}
                    </span>
                  </div>
                  <div style={{ height: 8, background: "#eef2f7", borderRadius: 999, marginTop: 6, overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${Math.round((g.count / max) * 100)}%`,
                        background: "var(--primary)",
                        borderRadius: 999,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="filterbar">
          <select value={grade} onChange={(e) => setGrade(e.target.value)}>
            <option value="">全部年级</option>
            {GRADE_OPTIONS.map((g) => (
              <option key={g} value={g}>
                {["一", "二", "三", "四", "五", "六"][g - 1]}年级
              </option>
            ))}
          </select>
          <select value={level} onChange={(e) => setLevel(e.target.value)}>
            <option value="">全部等级</option>
            {["优秀", "良好", "合格", "待提升"].map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">全部来源</option>
            <option value="text">文字输入</option>
            <option value="image">图片上传</option>
          </select>
          <select value={range} onChange={(e) => setRange(e.target.value)}>
            {RANGE_OPTIONS.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </select>
          <select value={band} onChange={(e) => setBand(e.target.value)}>
            {SCORE_BANDS.map((b) => (
              <option key={b.key} value={b.key}>
                {b.label}
              </option>
            ))}
          </select>
          <input
            placeholder="搜索作文题目"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") applyFilter();
            }}
            style={{ minWidth: 180 }}
          />
          <button className="btn btn-sm primary" onClick={applyFilter}>
            查询
          </button>
          <button className="btn btn-sm" onClick={reset}>
            重置
          </button>
          <a className="btn btn-sm" href={exportUrl} style={{ marginLeft: "auto" }}>
            导出 CSV
          </a>
        </div>
      </div>

      <table className="tbl">
        <thead>
          <tr>
            <th style={{ width: 150 }}>提交时间</th>
            <th style={{ width: 110 }}>年级 / 体裁</th>
            <th style={{ width: 70 }}>字数</th>
            <th style={{ width: 70 }}>来源</th>
            <th style={{ width: 60 }}>总分</th>
            <th style={{ width: 80 }}>等级</th>
            <th>总评</th>
            <th style={{ width: 88 }}>操作</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={8} style={{ textAlign: "center", color: "var(--muted)", padding: 24 }}>
                加载中…
              </td>
            </tr>
          ) : items.length === 0 ? (
            <tr>
              <td colSpan={8} style={{ textAlign: "center", color: "var(--muted)", padding: 24 }}>
                {notConfigured ? "服务未接通，暂无数据" : "没有符合条件的记录"}
              </td>
            </tr>
          ) : (
            items.map((it) => (
              <tr key={it.id}>
                <td style={{ color: "var(--muted)", fontSize: 12.5 }}>{fmtTime(it.createdAt)}</td>
                <td>
                  {it.gradeLabel}
                  {it.genre ? <span style={{ color: "var(--muted)" }}> · {it.genre}</span> : null}
                </td>
                <td>{it.charCount}</td>
                <td>
                  <span className={`badge${it.source === "image" ? " draft" : ""}`}>
                    {it.source === "image" ? "图片" : "文字"}
                  </span>
                </td>
                <td style={{ fontWeight: 700 }}>{it.total}</td>
                <td>
                  <span className={`badge ${LEVEL_STYLE[it.level] ?? ""}`}>{it.level}</span>
                </td>
                <td style={{ fontSize: 12.5, color: "var(--muted)" }}>{it.summary || "—"}</td>
                <td>
                  {/* nowrap：否则「查看」两个字会被窄列挤成上下两行 */}
                  <Link href={`/admin/essays/${it.id}`} className="btn btn-sm" style={{ whiteSpace: "nowrap" }}>
                    查看
                  </Link>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div className="pager">
        <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          上一页
        </button>
        <span style={{ color: "var(--muted)", fontSize: 13 }}>
          第 {page} / {totalPages} 页
        </span>
        <button className="btn btn-sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
          下一页
        </button>
      </div>

      <div style={{ marginTop: 18, color: "var(--muted)", fontSize: 12, lineHeight: 1.8 }}>
        家长提交的作文属未成年人原创内容，仅限内部查看，不得外传或用于宣传素材。
        本页不提供单条删除与正文导出：家长手里的报告链接长期有效，删除会让已发出的报告变成 404。
      </div>
    </>
  );
}
