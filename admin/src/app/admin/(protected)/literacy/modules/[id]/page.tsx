"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

interface ModuleForm {
  slug: string;
  num: string;
  title: string;
  summary: string;
  desc: string;
  icon: string;
  goal: string;
  toolSlugs: string;
  keywords: string;
  order: string;
  status: string;
}
interface LessonRow {
  id: string;
  slug: string;
  title: string;
  source: string;
  linkStatus: string;
  status: string;
  sopCount: number;
}

const statusBadge = (s: string) =>
  s === "published" ? <span className="badge ok">已发布</span> : <span className="badge">草稿</span>;
const linkBadge = (s: string) => {
  if (s === "ok") return <span className="badge ok">正常</span>;
  if (s === "warn") return <span className="badge warn">可疑</span>;
  if (s === "broken") return <span className="badge danger">失效</span>;
  return <span className="badge">未检</span>;
};

export default function ModuleEditor() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();

  const [form, setForm] = useState<ModuleForm>({
    slug: "",
    num: "",
    title: "",
    summary: "",
    desc: "",
    icon: "BookOpen",
    goal: "",
    toolSlugs: "",
    keywords: "",
    order: "0",
    status: "draft",
  });
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/literacy/modules/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.slug) {
          setErr("模块不存在");
          return;
        }
        setForm({
          slug: d.slug,
          num: d.num ?? "",
          title: d.title ?? "",
          summary: d.summary ?? "",
          desc: d.desc ?? "",
          icon: d.icon ?? "BookOpen",
          goal: d.goal ?? "",
          toolSlugs: (d.toolSlugs ?? []).join(", "),
          keywords: (d.keywords ?? []).join(", "),
          order: String(d.order ?? 0),
          status: d.status ?? "draft",
        });
        return fetch(`/api/admin/literacy/lessons?moduleId=${id}`).then((r) => r.json());
      })
      .then((ls: LessonRow[] | undefined) => {
        if (ls) setLessons(ls);
        setLoaded(true);
      })
      .catch(() => setErr("加载失败"));
  }, [id]);

  function setField<K extends keyof ModuleForm>(k: K, v: string) {
    setSaved(false);
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save() {
    setErr("");
    const payload = {
      slug: form.slug,
      num: form.num,
      title: form.title,
      summary: form.summary,
      desc: form.desc,
      icon: form.icon,
      goal: form.goal || null,
      toolSlugs: form.toolSlugs
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      keywords: form.keywords
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      order: Number(form.order) || 0,
      status: form.status,
    };
    setSaving(true);
    const res = await fetch(`/api/admin/literacy/modules/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setErr(d.error || "保存失败");
    }
  }

  if (!loaded) return <div className="empty">加载中…</div>;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>编辑模块</h1>
          <div className="desc">ID {id}</div>
        </div>
        <div className="row-actions">
          <Link href="/admin/literacy" className="btn">
            返回总览
          </Link>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="grid cols-2">
          <label className="field">
            <span>slug</span>
            <input className="inp" value={form.slug} onChange={(e) => setField("slug", e.target.value)} />
          </label>
          <label className="field">
            <span>编号(num)</span>
            <input className="inp" value={form.num} onChange={(e) => setField("num", e.target.value)} />
          </label>
          <label className="field">
            <span>标题</span>
            <input className="inp" value={form.title} onChange={(e) => setField("title", e.target.value)} />
          </label>
          <label className="field">
            <span>图标(Phosphor 名)</span>
            <input className="inp" value={form.icon} onChange={(e) => setField("icon", e.target.value)} />
          </label>
          <label className="field">
            <span>排序(order)</span>
            <input className="inp" type="number" value={form.order} onChange={(e) => setField("order", e.target.value)} />
          </label>
          <label className="field">
            <span>状态</span>
            <select className="inp" value={form.status} onChange={(e) => setField("status", e.target.value)}>
              <option value="draft">草稿</option>
              <option value="published">已发布</option>
            </select>
          </label>
        </div>

        <label className="field">
          <span>一句话简介(summary)</span>
          <input className="inp" value={form.summary} onChange={(e) => setField("summary", e.target.value)} />
        </label>
        <label className="field">
          <span>模块详述(desc)</span>
          <textarea className="inp" rows={3} value={form.desc} onChange={(e) => setField("desc", e.target.value)} />
        </label>
        <label className="field">
          <span>学习目标(goal)</span>
          <input className="inp" value={form.goal} onChange={(e) => setField("goal", e.target.value)} />
        </label>
        <div className="grid cols-2">
          <label className="field">
            <span>关联工具 slug（逗号分隔）</span>
            <input className="inp" value={form.toolSlugs} onChange={(e) => setField("toolSlugs", e.target.value)} placeholder="kimi, doubao" />
          </label>
          <label className="field">
            <span>关键词（逗号分隔）</span>
            <input className="inp" value={form.keywords} onChange={(e) => setField("keywords", e.target.value)} placeholder="AI, 提示词" />
          </label>
        </div>

        {err && <div style={{ color: "var(--danger)", fontSize: 13 }}>{err}</div>}
        {saved && <div style={{ color: "var(--ok, #16a34a)", fontSize: 13 }}>已保存 ✓</div>}
        <button className="btn primary" onClick={save} disabled={saving} style={{ marginTop: 8 }}>
          {saving ? "保存中…" : "保存模块"}
        </button>
      </div>

      <div className="card">
        <div className="nav-group">本模块课时（{lessons.length}）</div>
        {lessons.length === 0 ? (
          <div className="empty">暂无课时，去总览新建</div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>标题</th>
                <th>来源</th>
                <th>外链</th>
                <th>SOP</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {lessons.map((l) => (
                <tr key={l.id}>
                  <td>{l.title}</td>
                  <td>{l.source === "official" ? "官方" : "本站"}</td>
                  <td>{linkBadge(l.linkStatus)}</td>
                  <td>{l.sopCount}</td>
                  <td>{statusBadge(l.status)}</td>
                  <td>
                    <Link href={`/admin/literacy/lessons/${l.id}`} className="btn sm">
                      编辑
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
