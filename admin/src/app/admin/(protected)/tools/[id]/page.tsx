"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

interface FormState {
  slug: string;
  name: string;
  logo: string;
  color: string;
  tagline: string;
  url: string;
  pricing: string;
  platform: string;
  roles: string;
  scenes: string;
  subjects: string;
  pros: string;
  cons: string;
  alts: string;
  compliance: string;
  status: string;
  rating: string;
}

const EMPTY: FormState = {
  slug: "",
  name: "",
  logo: "",
  color: "#2f6bff",
  tagline: "",
  url: "",
  pricing: "Free",
  platform: "",
  roles: "",
  scenes: "",
  subjects: "",
  pros: "",
  cons: "",
  alts: "",
  compliance: "",
  status: "draft",
  rating: "0",
};

const csv = (v: string) => v.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
const join = (a: unknown) => (Array.isArray(a) ? a.join("，") : String(a ?? ""));

export default function ToolEditor() {
  const params = useParams();
  const id = params.id as string;
  const isNew = id === "new";
  const router = useRouter();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isNew) {
      setLoaded(true);
      return;
    }
    fetch(`/api/admin/tools/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.id) {
          setErr("工具不存在");
          return;
        }
        setForm({
          slug: d.slug,
          name: d.name,
          logo: d.logo,
          color: d.color,
          tagline: d.tagline,
          url: d.url,
          pricing: d.pricing,
          platform: d.platform,
          roles: join(JSON.parse(d.roles || "[]")),
          scenes: join(JSON.parse(d.scenes || "[]")),
          subjects: join(JSON.parse(d.subjects || "[]")),
          pros: join(JSON.parse(d.pros || "[]")),
          cons: join(JSON.parse(d.cons || "[]")),
          alts: join(JSON.parse(d.alts || "[]")),
          compliance: d.compliance,
          status: d.status,
          rating: String(d.rating ?? 0),
        });
        setLoaded(true);
      });
  }, [id, isNew]);

  function set<K extends keyof FormState>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save() {
    setErr("");
    setSaving(true);
    const payload = {
      slug: form.slug,
      name: form.name,
      logo: form.logo,
      color: form.color,
      tagline: form.tagline,
      url: form.url,
      pricing: form.pricing,
      platform: form.platform,
      roles: csv(form.roles),
      scenes: csv(form.scenes),
      subjects: csv(form.subjects),
      pros: csv(form.pros),
      cons: csv(form.cons),
      alts: csv(form.alts),
      compliance: form.compliance,
      status: form.status,
      rating: Number(form.rating) || 0,
    };
    const res = await fetch(isNew ? "/api/admin/tools" : `/api/admin/tools/${id}`, {
      method: isNew ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (res.ok) {
      router.push("/admin/tools");
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
          <h1>{isNew ? "新建工具" : "编辑工具"}</h1>
          <div className="desc">slug 创建后建议不变；数组字段用逗号分隔</div>
        </div>
        <Link href="/admin/tools" className="btn">
          返回列表
        </Link>
      </div>

      <div className="card grid cols-2">
        <label className="field">
          <span>名称 *</span>
          <input className="inp" value={form.name} onChange={(e) => set("name", e.target.value)} />
        </label>
        <label className="field">
          <span>slug *</span>
          <input className="inp" value={form.slug} disabled={!isNew} onChange={(e) => set("slug", e.target.value)} />
        </label>
        <label className="field">
          <span>logo 文字</span>
          <input className="inp" value={form.logo} onChange={(e) => set("logo", e.target.value)} />
        </label>
        <label className="field">
          <span>主题色</span>
          <input className="inp" type="color" value={form.color} onChange={(e) => set("color", e.target.value)} />
        </label>
        <label className="field">
          <span>一句话简介</span>
          <input className="inp" value={form.tagline} onChange={(e) => set("tagline", e.target.value)} />
        </label>
        <label className="field">
          <span>官网 URL</span>
          <input className="inp" value={form.url} onChange={(e) => set("url", e.target.value)} />
        </label>
        <label className="field">
          <span>定价</span>
          <select className="inp" value={form.pricing} onChange={(e) => set("pricing", e.target.value)}>
            <option>Free</option>
            <option>Freemium</option>
            <option>Paid</option>
            <option>Enterprise</option>
          </select>
        </label>
        <label className="field">
          <span>平台</span>
          <input className="inp" value={form.platform} onChange={(e) => set("platform", e.target.value)} />
        </label>
        <label className="field">
          <span>角色（逗号分隔）</span>
          <input className="inp" value={form.roles} onChange={(e) => set("roles", e.target.value)} />
        </label>
        <label className="field">
          <span>场景 key（逗号分隔）</span>
          <input className="inp" value={form.scenes} onChange={(e) => set("scenes", e.target.value)} />
        </label>
        <label className="field">
          <span>学科（逗号分隔）</span>
          <input className="inp" value={form.subjects} onChange={(e) => set("subjects", e.target.value)} />
        </label>
        <label className="field">
          <span>优点（逗号分隔）</span>
          <input className="inp" value={form.pros} onChange={(e) => set("pros", e.target.value)} />
        </label>
        <label className="field">
          <span>缺点（逗号分隔）</span>
          <input className="inp" value={form.cons} onChange={(e) => set("cons", e.target.value)} />
        </label>
        <label className="field">
          <span>替代工具 slug（逗号分隔）</span>
          <input className="inp" value={form.alts} onChange={(e) => set("alts", e.target.value)} />
        </label>
        <label className="field">
          <span>评分</span>
          <input className="inp" type="number" step="0.1" value={form.rating} onChange={(e) => set("rating", e.target.value)} />
        </label>
        <label className="field">
          <span>状态</span>
          <select className="inp" value={form.status} onChange={(e) => set("status", e.target.value)}>
            <option value="draft">草稿</option>
            <option value="published">已发布</option>
          </select>
        </label>
        <label className="field" style={{ gridColumn: "1 / -1" }}>
          <span>合规说明</span>
          <textarea className="inp" value={form.compliance} onChange={(e) => set("compliance", e.target.value)} />
        </label>
      </div>

      {err && <div className="login-err" style={{ color: "var(--danger)" }}>{err}</div>}
      <button className="btn primary" onClick={save} disabled={saving} style={{ marginTop: 12 }}>
        {saving ? "保存中…" : "保存"}
      </button>
    </>
  );
}
