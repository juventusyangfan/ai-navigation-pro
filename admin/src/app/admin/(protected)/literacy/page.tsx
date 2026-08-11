"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface ModuleRow {
  id: string;
  slug: string;
  num: string;
  title: string;
  summary: string;
  status: string;
  lessonCount: number;
}
interface LessonRow {
  id: string;
  slug: string;
  moduleSlug: string;
  moduleTitle: string;
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

export default function LiteracyOverview() {
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // 新建模块
  const [mSlug, setMSlug] = useState("");
  const [mTitle, setMTitle] = useState("");
  const [creatingM, setCreatingM] = useState(false);

  // 新建课时
  const [modId, setModId] = useState("");
  const [lSlug, setLSlug] = useState("");
  const [lTitle, setLTitle] = useState("");
  const [creatingL, setCreatingL] = useState(false);

  const router = useRouter();

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/literacy/modules").then((r) => r.json()),
      fetch("/api/admin/literacy/lessons").then((r) => r.json()),
    ])
      .then(([m, l]) => {
        setModules(m);
        setLessons(l);
        setModId(m[0]?.id ?? "");
        setLoading(false);
      })
      .catch(() => {
        setErr("加载失败");
        setLoading(false);
      });
  }, []);

  async function createModule() {
    if (!mSlug || !mTitle) return;
    setCreatingM(true);
    const res = await fetch("/api/admin/literacy/modules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: mSlug,
        num: String(modules.length + 1),
        title: mTitle,
        summary: "",
        desc: "",
        icon: "BookOpen",
        status: "draft",
        order: modules.length,
      }),
    });
    setCreatingM(false);
    if (res.ok) {
      const m = await res.json();
      router.push(`/admin/literacy/modules/${m.id}`);
    } else {
      const d = await res.json().catch(() => ({}));
      alert(d.error || "创建失败");
    }
  }

  async function createLesson() {
    if (!modId || !lSlug || !lTitle) return;
    setCreatingL(true);
    const res = await fetch("/api/admin/literacy/lessons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        moduleId: modId,
        slug: lSlug,
        title: lTitle,
        source: "official",
        hook: "",
        guideIntro: "",
        afterAction: "",
        status: "draft",
      }),
    });
    setCreatingL(false);
    if (res.ok) {
      const l = await res.json();
      router.push(`/admin/literacy/lessons/${l.id}`);
    } else {
      const d = await res.json().catch(() => ({}));
      alert(d.error || "创建失败");
    }
  }

  async function delModule(id: string) {
    if (!confirm("确认删除该模块？其下课时需先清空。")) return;
    const res = await fetch(`/api/admin/literacy/modules/${id}`, { method: "DELETE" });
    if (res.ok) setModules((m) => m.filter((x) => x.id !== id));
    else {
      const d = await res.json().catch(() => ({}));
      alert(d.error || "删除失败");
    }
  }

  async function delLesson(id: string) {
    if (!confirm("确认删除该课时？")) return;
    const res = await fetch(`/api/admin/literacy/lessons/${id}`, { method: "DELETE" });
    if (res.ok) setLessons((l) => l.filter((x) => x.id !== id));
    else {
      const d = await res.json().catch(() => ({}));
      alert(d.error || "删除失败");
    }
  }

  const lessonsByModule: Record<string, LessonRow[]> = {};
  for (const l of lessons) (lessonsByModule[l.moduleTitle] ??= []).push(l);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>AI 通识课</h1>
          <div className="desc">
            桥接国家中小学智慧教育平台《学AI》：本站只做导学，不镜像课程正文。
          </div>
        </div>
        <div className="row-actions">
          <Link href="/admin/literacy/links" className="btn">
            外链健康
          </Link>
        </div>
      </div>

      {err && <div style={{ color: "var(--danger)", fontSize: 13 }}>{err}</div>}

      <div className="grid cols-2" style={{ marginBottom: 16 }}>
        <div className="card">
          <h3>+ 新建模块</h3>
          <div className="grid cols-2">
            <label className="field">
              <span>slug（英文/数字/连字符）</span>
              <input className="inp" value={mSlug} onChange={(e) => setMSlug(e.target.value)} placeholder="what-is-ai" />
            </label>
            <label className="field">
              <span>标题</span>
              <input className="inp" value={mTitle} onChange={(e) => setMTitle(e.target.value)} placeholder="什么是人工智能" />
            </label>
          </div>
          <button className="btn primary" onClick={createModule} disabled={creatingM || !mSlug || !mTitle}>
            {creatingM ? "创建中…" : "创建模块"}
          </button>
        </div>

        <div className="card">
          <h3>+ 新建课时</h3>
          <div className="grid cols-2">
            <label className="field">
              <span>所属模块</span>
              <select className="inp" value={modId} onChange={(e) => setModId(e.target.value)}>
                {modules.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>slug</span>
              <input className="inp" value={lSlug} onChange={(e) => setLSlug(e.target.value)} placeholder="lesson-1" />
            </label>
          </div>
          <label className="field">
            <span>标题</span>
            <input className="inp" value={lTitle} onChange={(e) => setLTitle(e.target.value)} placeholder="课时标题" />
          </label>
          <button className="btn primary" onClick={createLesson} disabled={creatingL || !modId || !lSlug || !lTitle}>
            {creatingL ? "创建中…" : "创建课时"}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="empty">加载中…</div>
      ) : (
        <>
          <h2 style={{ margin: "8px 0" }}>模块（{modules.length}）</h2>
          <table className="tbl">
            <thead>
              <tr>
                <th>slug</th>
                <th>标题</th>
                <th>课时数</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {modules.map((m) => (
                <tr key={m.id}>
                  <td>{m.slug}</td>
                  <td>{m.title}</td>
                  <td>{m.lessonCount}</td>
                  <td>{statusBadge(m.status)}</td>
                  <td>
                    <div className="row-actions">
                      <Link href={`/admin/literacy/modules/${m.id}`} className="btn sm">
                        编辑
                      </Link>
                      <button className="btn sm danger" onClick={() => delModule(m.id)}>
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2 style={{ margin: "18px 0 8px" }}>课时（{lessons.length}）</h2>
          {Object.entries(lessonsByModule).map(([modTitle, rows]) => (
            <div key={modTitle} style={{ marginBottom: 14 }}>
              <h3 style={{ margin: "8px 0" }}>{modTitle}</h3>
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
                  {rows.map((l) => (
                    <tr key={l.id}>
                      <td>{l.title}</td>
                      <td>{l.source === "official" ? "官方" : "本站"}</td>
                      <td>{linkBadge(l.linkStatus)}</td>
                      <td>{l.sopCount}</td>
                      <td>{statusBadge(l.status)}</td>
                      <td>
                        <div className="row-actions">
                          <Link href={`/admin/literacy/lessons/${l.id}`} className="btn sm">
                            编辑
                          </Link>
                          <button className="btn sm danger" onClick={() => delLesson(l.id)}>
                            删除
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </>
      )}
    </>
  );
}
