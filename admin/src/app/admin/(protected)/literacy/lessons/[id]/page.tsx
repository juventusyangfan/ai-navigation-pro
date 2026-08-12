"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

interface ModOpt {
  id: string;
  slug: string;
  title: string;
}
interface SopOpt {
  id: string; // = sopPathId
  title: string;
  toolName: string;
  stepCount: number;
}
interface SopAssoc {
  sopPathId: string;
  reason: string;
}

interface LessonForm {
  moduleSlug: string;
  slug: string;
  title: string;
  order: string;
  source: string;
  stage: string;
  durationMin: string;
  hook: string;
  guideIntro: string;
  watchPoints: string; // 一行一条
  afterAction: string;
  editorNote: string;
  faq: string; // JSON 数组
  keywords: string; // 逗号
  officialUrl: string;
  officialProvider: string;
  officialColumn: string;
  fallbackUrl: string;
  archiveNote: string;
  status: string;
  linkStatus: string;
}

const EMPTY: LessonForm = {
  moduleSlug: "",
  slug: "",
  title: "",
  order: "0",
  source: "official",
  stage: "",
  durationMin: "",
  hook: "",
  guideIntro: "",
  watchPoints: "",
  afterAction: "",
  editorNote: "",
  faq: "[]",
  keywords: "",
  officialUrl: "",
  officialProvider: "国家中小学智慧教育平台",
  officialColumn: "学AI",
  fallbackUrl: "",
  archiveNote: "",
  status: "draft",
  linkStatus: "unchecked",
};

export default function LessonEditor() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();

  const [form, setForm] = useState<LessonForm>(EMPTY);
  const [modules, setModules] = useState<ModOpt[]>([]);
  const [sopOpts, setSopOpts] = useState<SopOpt[]>([]);
  const [assoc, setAssoc] = useState<SopAssoc[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingSop, setSavingSop] = useState(false);
  const [err, setErr] = useState("");
  const [linkInfo, setLinkInfo] = useState<string>("");

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/literacy/modules").then((r) => r.json()),
      fetch("/api/admin/sops").then((r) => r.json()),
    ])
      .then(([ms, ss]) => {
        setModules(ms);
        setSopOpts(ss);
        return fetch(`/api/admin/literacy/lessons/${id}`).then((r) => r.json());
      })
      .then((d: Record<string, unknown>) => {
        if (!d.slug) {
          setErr("课时不存在");
          return;
        }
        const faq = Array.isArray(d.faq) ? d.faq : [];
        setForm({
          moduleSlug: (d.moduleSlug as string) ?? "",
          slug: (d.slug as string) ?? "",
          title: (d.title as string) ?? "",
          order: String(d.order ?? 0),
          source: (d.source as string) ?? "official",
          stage: (d.stage as string) ?? "",
          durationMin: d.durationMin != null ? String(d.durationMin) : "",
          hook: (d.hook as string) ?? "",
          guideIntro: (d.guideIntro as string) ?? "",
          watchPoints: ((d.watchPoints as string[]) ?? []).join("\n"),
          afterAction: (d.afterAction as string) ?? "",
          editorNote: (d.editorNote as string) ?? "",
          faq: JSON.stringify(faq, null, 0),
          keywords: ((d.keywords as string[]) ?? []).join(", "),
          officialUrl: (d.officialUrl as string) ?? "",
          officialProvider: (d.officialProvider as string) ?? "国家中小学智慧教育平台",
          officialColumn: (d.officialColumn as string) ?? "学AI",
          fallbackUrl: (d.fallbackUrl as string) ?? "",
          archiveNote: (d.archiveNote as string) ?? "",
          status: (d.status as string) ?? "draft",
          linkStatus: (d.linkStatus as string) ?? "unchecked",
        });
        const sops = (d.sops as { sopPathId: string; reason?: string }[]) ?? [];
        setAssoc(sops.map((s) => ({ sopPathId: s.sopPathId, reason: s.reason ?? "" })));
        setLoaded(true);
      })
      .catch(() => setErr("加载失败"));
  }, [id]);

  function setField<K extends keyof LessonForm>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function toggleSop(sopPathId: string, checked: boolean) {
    setAssoc((a) =>
      checked
        ? a.some((x) => x.sopPathId === sopPathId)
          ? a
          : [...a, { sopPathId, reason: "" }]
        : a.filter((x) => x.sopPathId !== sopPathId),
    );
  }
  function setReason(sopPathId: string, reason: string) {
    setAssoc((a) => a.map((x) => (x.sopPathId === sopPathId ? { ...x, reason } : x)));
  }

  async function save() {
    setErr("");
    let watchPoints: string[] = [];
    let faq: unknown;
    try {
      watchPoints = form.watchPoints
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      faq = JSON.parse(form.faq || "[]");
    } catch {
      setErr("watchPoints / faq 格式有误（faq 需为 JSON 数组）");
      return;
    }
    const payload = {
      moduleSlug: form.moduleSlug,
      slug: form.slug,
      title: form.title,
      order: Number(form.order) || 0,
      source: form.source,
      stage: form.stage || null,
      durationMin: form.durationMin ? Number(form.durationMin) : null,
      hook: form.hook,
      guideIntro: form.guideIntro,
      watchPoints,
      afterAction: form.afterAction,
      editorNote: form.editorNote || null,
      faq,
      keywords: form.keywords
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      officialUrl: form.officialUrl || null,
      officialProvider: form.officialProvider || null,
      officialColumn: form.officialColumn || null,
      fallbackUrl: form.fallbackUrl || null,
      archiveNote: form.archiveNote || null,
      status: form.status,
      linkStatus: form.linkStatus,
    };
    setSaving(true);
    const res = await fetch(`/api/admin/literacy/lessons/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (res.ok) router.refresh();
    else {
      const d = await res.json().catch(() => ({}));
      setErr(d.error || "保存失败");
    }
  }

  async function saveSops() {
    setErr("");
    setSavingSop(true);
    const res = await fetch(`/api/admin/literacy/lessons/${id}/sops`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sops: assoc.map((a) => ({ sopPathId: a.sopPathId, reason: a.reason || null })) }),
    });
    setSavingSop(false);
    if (res.ok) router.refresh();
    else {
      const d = await res.json().catch(() => ({}));
      setErr(d.error || "保存 SOP 关联失败");
    }
  }

  async function checkLink() {
    setLinkInfo("探活中…");
    const res = await fetch(`/api/admin/literacy/lessons/${id}/check-link`, { method: "POST" });
    if (res.ok) {
      const d = await res.json();
      setLinkInfo(`结果：${d.status} · HTTP ${d.httpCode ?? "-"}`);
      setForm((f) => ({ ...f, linkStatus: d.status }));
    } else {
      const d = await res.json().catch(() => ({}));
      setLinkInfo(d.error || "探活失败");
    }
  }

  if (!loaded) return <div className="empty">加载中…</div>;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>编辑课时</h1>
          <div className="desc">ID {id}</div>
        </div>
        <div className="row-actions">
          <Link href="/admin/literacy" className="btn">
            返回总览
          </Link>
        </div>
      </div>

      {err && <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 8 }}>{err}</div>}

      <div className="grid cols-2" style={{ alignItems: "start" }}>
        <div className="card">
          <h3>基础信息</h3>
          <div className="grid cols-2">
            <label className="field">
              <span>所属模块</span>
              <select className="inp" value={form.moduleSlug} onChange={(e) => setField("moduleSlug", e.target.value)}>
                {modules.map((m) => (
                  <option key={m.id} value={m.slug}>
                    {m.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>slug</span>
              <input className="inp" value={form.slug} onChange={(e) => setField("slug", e.target.value)} />
            </label>
            <label className="field">
              <span>标题</span>
              <input className="inp" value={form.title} onChange={(e) => setField("title", e.target.value)} />
            </label>
            <label className="field">
              <span>排序(order)</span>
              <input className="inp" type="number" value={form.order} onChange={(e) => setField("order", e.target.value)} />
            </label>
            <label className="field">
              <span>来源</span>
              <select className="inp" value={form.source} onChange={(e) => setField("source", e.target.value)}>
                <option value="official">官方课</option>
                <option value="original">本站原创</option>
                <option value="ugc">用户投稿</option>
              </select>
            </label>
            <label className="field">
              <span>学段(stage)</span>
              <input className="inp" value={form.stage} onChange={(e) => setField("stage", e.target.value)} placeholder="小学/初中/高中" />
            </label>
            <label className="field">
              <span>时长(分)</span>
              <input className="inp" type="number" value={form.durationMin} onChange={(e) => setField("durationMin", e.target.value)} />
            </label>
            <label className="field">
              <span>状态</span>
              <select className="inp" value={form.status} onChange={(e) => setField("status", e.target.value)}>
                <option value="draft">草稿</option>
                <option value="published">已发布</option>
                <option value="archived">已报废(L3→301)</option>
              </select>
            </label>
          </div>

          <label className="field">
            <span>导语(hook)</span>
            <input className="inp" value={form.hook} onChange={(e) => setField("hook", e.target.value)} />
          </label>
          <label className="field">
            <span>导学介绍(guideIntro)</span>
            <textarea className="inp" rows={3} value={form.guideIntro} onChange={(e) => setField("guideIntro", e.target.value)} />
          </label>
          <label className="field">
            <span>观看要点(watchPoints，一行一条)</span>
            <textarea className="inp" rows={3} value={form.watchPoints} onChange={(e) => setField("watchPoints", e.target.value)} />
          </label>
          <label className="field">
            <span>看完之后做啥(afterAction)</span>
            <textarea className="inp" rows={2} value={form.afterAction} onChange={(e) => setField("afterAction", e.target.value)} />
          </label>
          <label className="field">
            <span>编辑点评(editorNote)</span>
            <textarea className="inp" rows={2} value={form.editorNote} onChange={(e) => setField("editorNote", e.target.value)} />
          </label>
          <label className="field">
            <span>FAQ（JSON 数组 {"[{q,a}]"}）</span>
            <textarea className="inp" rows={3} value={form.faq} onChange={(e) => setField("faq", e.target.value)} />
          </label>
          <label className="field">
            <span>关键词（逗号分隔）</span>
            <input className="inp" value={form.keywords} onChange={(e) => setField("keywords", e.target.value)} />
          </label>

          <button className="btn primary" onClick={save} disabled={saving}>
            {saving ? "保存中…" : "保存课时"}
          </button>
        </div>

        <div className="card">
          <h3>官方课外链（桥接国家平台）</h3>
          <label className="field">
            <span>officialUrl</span>
            <input className="inp" value={form.officialUrl} onChange={(e) => setField("officialUrl", e.target.value)} placeholder="https://..." />
          </label>
          <div className="grid cols-2">
            <label className="field">
              <span>官方提供方</span>
              <input className="inp" value={form.officialProvider} onChange={(e) => setField("officialProvider", e.target.value)} />
            </label>
            <label className="field">
              <span>栏目(officialColumn)</span>
              <input className="inp" value={form.officialColumn} onChange={(e) => setField("officialColumn", e.target.value)} />
            </label>
          </div>
          <label className="field">
            <span>兜底链接(fallbackUrl，发布必填)</span>
            <input className="inp" value={form.fallbackUrl} onChange={(e) => setField("fallbackUrl", e.target.value)} />
          </label>
          <label className="field">
            <span>报废说明(archiveNote)</span>
            <input className="inp" value={form.archiveNote} onChange={(e) => setField("archiveNote", e.target.value)} />
          </label>
          <div className="grid cols-2">
            <label className="field">
              <span>外链状态(linkStatus)</span>
              <select className="inp" value={form.linkStatus} onChange={(e) => setField("linkStatus", e.target.value)}>
                <option value="unchecked">未检</option>
                <option value="ok">正常</option>
                <option value="warn">可疑</option>
                <option value="broken">失效</option>
              </select>
            </label>
            <div className="field" style={{ justifyContent: "flex-end" }}>
              <button className="btn sm" onClick={checkLink} disabled={!form.officialUrl}>
                探活外链
              </button>
            </div>
          </div>
          {linkInfo && <div style={{ fontSize: 13, color: "var(--muted)" }}>{linkInfo}</div>}

          <h3 style={{ marginTop: 14 }}>关联 SOP（本站动手练）</h3>
          <div className="sop-pick">
            {sopOpts.map((s) => {
              const checked = assoc.some((a) => a.sopPathId === s.id);
              return (
                <div className="sop-pick-item" key={s.id}>
                  <label style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => toggleSop(s.id, e.target.checked)}
                      style={{ marginTop: 4 }}
                    />
                    <span style={{ flex: 1 }}>
                      <b>{s.title}</b>
                      <span style={{ color: "var(--muted)", fontSize: 12, marginLeft: 6 }}>
                        {s.toolName} · {s.stepCount} 步
                      </span>
                      {checked && (
                        <input
                          className="inp"
                          style={{ marginTop: 6 }}
                          placeholder="关联理由(选填)"
                          value={assoc.find((a) => a.sopPathId === s.id)?.reason ?? ""}
                          onChange={(e) => setReason(s.id, e.target.value)}
                        />
                      )}
                    </span>
                  </label>
                </div>
              );
            })}
          </div>
          <button className="btn primary" onClick={saveSops} disabled={savingSop} style={{ marginTop: 8 }}>
            {savingSop ? "保存中…" : "保存 SOP 关联"}
          </button>
        </div>
      </div>
    </>
  );
}
