"use client";

import { useEffect, useState } from "react";

interface Category {
  key: string;
  name: string;
  icon: string;
  phase: string;
  desc: string;
  order: number;
}
interface Scene {
  key: string;
  name: string;
  cat: string;
  icon: string;
  roles: string[];
}

export default function TaxonomyPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ key: "", name: "", cat: "", icon: "Circle", roles: "老师" });
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/admin/taxonomy")
      .then((r) => r.json())
      .then((d) => {
        setCategories(d.categories);
        setScenes(d.scenes);
        setForm((f) => ({ ...f, cat: d.categories[0]?.key ?? "" }));
        setLoading(false);
      });
  }, []);

  async function addScene() {
    setErr("");
    const res = await fetch("/api/admin/taxonomy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, roles: form.roles.split(/[,，]/).map((s) => s.trim()).filter(Boolean) }),
    });
    if (res.ok) {
      const s = await res.json();
      setScenes((prev) => [...prev, s]);
      setForm((f) => ({ ...f, key: "", name: "" }));
    } else {
      const d = await res.json().catch(() => ({}));
      setErr(d.error || "创建失败");
    }
  }

  if (loading) return <div className="empty">加载中…</div>;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>分类法</h1>
          <div className="desc">维护教学场景（scenes）与分类（categories）</div>
        </div>
      </div>

      <div className="grid cols-2">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>分类（categories）</h3>
          <table className="tbl">
            <thead>
              <tr>
                <th>key</th>
                <th>名称</th>
                <th>阶段</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.key}>
                  <td>
                    <code>{c.key}</code>
                  </td>
                  <td>{c.name}</td>
                  <td>{c.phase}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ color: "var(--muted)", fontSize: 12 }}>分类为种子内置，编辑/删除留待 Phase 3。</p>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>场景（scenes）</h3>
          <table className="tbl">
            <thead>
              <tr>
                <th>key</th>
                <th>名称</th>
                <th>分类</th>
                <th>角色</th>
              </tr>
            </thead>
            <tbody>
              {scenes.map((s) => (
                <tr key={s.key}>
                  <td>
                    <code>{s.key}</code>
                  </td>
                  <td>{s.name}</td>
                  <td>{s.cat}</td>
                  <td>{s.roles.join("、")}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h4>新增场景</h4>
          <div className="grid cols-2">
            <label className="field">
              <span>key</span>
              <input className="inp" value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} />
            </label>
            <label className="field">
              <span>名称</span>
              <input className="inp" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            <label className="field">
              <span>分类</span>
              <select className="inp" value={form.cat} onChange={(e) => setForm({ ...form, cat: e.target.value })}>
                {categories.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>角色(逗号)</span>
              <input className="inp" value={form.roles} onChange={(e) => setForm({ ...form, roles: e.target.value })} />
            </label>
          </div>
          {err && <div style={{ color: "var(--danger)", fontSize: 13 }}>{err}</div>}
          <button className="btn primary" onClick={addScene}>
            + 添加场景
          </button>
        </div>
      </div>
    </>
  );
}
