"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

interface StepForm {
  goal: string;
  action: string;
  prompt: string;
  outputSample: string;
  mediaType: string;
  mediaLabel: string;
  pitfall: string;
  tip: string;
  branchText: string;
}

interface MetaForm {
  title: string;
  summary: string;
  estMinutes: string;
  level: string;
  forRole: string;
  isLibraryPick: boolean;
}

interface PathListItem {
  id: string;
  toolName: string;
  title: string;
}

const emptyStep = (): StepForm => ({
  goal: "",
  action: "",
  prompt: "",
  outputSample: "",
  mediaType: "",
  mediaLabel: "",
  pitfall: "",
  tip: "",
  branchText: "",
});

/** 把 {{变量}} 高亮为 chip，模拟前台 SopPathView 的提示词呈现 */
function highlightPrompt(text: string) {
  const parts = text.split(/(\{\{[^}]+\}\})/g);
  return parts.map((p, i) =>
    /\{\{[^}]+\}\}/.test(p) ? (
      <span className="var-chip" key={i}>
        {p}
      </span>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}

export default function SopEditor() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();

  const [list, setList] = useState<PathListItem[]>([]);
  const [meta, setMeta] = useState<MetaForm>({
    title: "",
    summary: "",
    estMinutes: "",
    level: "",
    forRole: "",
    isLibraryPick: false,
  });
  const [steps, setSteps] = useState<StepForm[]>([]);
  const [toolName, setToolName] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/admin/sops")
      .then((r) => r.json())
      .then((d) =>
        setList(d.map((p: { id: string; toolName: string; title: string }) => ({ id: p.id, toolName: p.toolName, title: p.title }))),
      );
  }, []);

  useEffect(() => {
    fetch(`/api/admin/sops/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.id) {
          setErr("SOP 路径不存在");
          return;
        }
        setToolName(d.tool?.name ?? "");
        setMeta({
          title: d.title,
          summary: d.summary ?? "",
          estMinutes: d.estMinutes != null ? String(d.estMinutes) : "",
          level: d.level ?? "",
          forRole: d.forRole ?? "",
          isLibraryPick: !!d.isLibraryPick,
        });
        setSteps(
          (d.steps ?? []).map((s: Record<string, unknown>) => ({
            goal: s.goal ?? "",
            action: s.action ?? "",
            prompt: s.prompt ?? "",
            outputSample: s.outputSample ?? "",
            mediaType: s.mediaType ?? "",
            mediaLabel: s.mediaLabel ?? "",
            pitfall: s.pitfall ?? "",
            tip: s.tip ?? "",
            branchText: s.branch ? JSON.stringify(s.branch) : "",
          })),
        );
        setLoaded(true);
      });
  }, [id]);

  function setMetaField<K extends keyof MetaForm>(k: K, v: MetaForm[K]) {
    setMeta((m) => ({ ...m, [k]: v }));
  }
  function setStep(i: number, field: keyof StepForm, v: string) {
    setSteps((ss) => ss.map((s, idx) => (idx === i ? { ...s, [field]: v } : s)));
  }
  function addStep() {
    setSteps((ss) => [...ss, emptyStep()]);
  }
  function removeStep(i: number) {
    setSteps((ss) => ss.filter((_, idx) => idx !== i));
  }

  async function save() {
    setErr("");
    // 校验 branch JSON
    for (const s of steps) {
      if (s.branchText.trim()) {
        try {
          JSON.parse(s.branchText);
        } catch {
          setErr("某步的 branch 不是合法 JSON（应为 [{when,then}] 数组）");
          return;
        }
      }
    }
    const payload = {
      title: meta.title,
      summary: meta.summary,
      estMinutes: meta.estMinutes ? Number(meta.estMinutes) : null,
      level: meta.level || null,
      forRole: meta.forRole || null,
      isLibraryPick: meta.isLibraryPick,
      steps: steps.map((s) => ({
        goal: s.goal,
        action: s.action,
        prompt: s.prompt,
        outputSample: s.outputSample,
        mediaType: s.mediaType || null,
        mediaLabel: s.mediaLabel,
        pitfall: s.pitfall,
        tip: s.tip,
        branch: s.branchText.trim() ? JSON.parse(s.branchText) : null,
      })),
    };
    setSaving(true);
    const res = await fetch(`/api/admin/sops/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (res.ok) {
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
          <h1>SOP 编辑器</h1>
          <div className="desc">
            工具：{toolName} · ID {id}
          </div>
        </div>
        <Link href="/admin/sops" className="btn">
          返回列表
        </Link>
      </div>

      <div className="sop-editor">
        {/* 左：路径列表 */}
        <div className="card path-list">
          <div className="nav-group" style={{ padding: "0 4px" }}>全部路径</div>
          {list.map((p) => (
            <Link
              key={p.id}
              href={`/admin/sops/${p.id}`}
              className={`path-item${p.id === id ? " active" : ""}`}
            >
              <div className="t">{p.title}</div>
              <div className="m">
                {p.toolName} · {p.id === id ? "编辑中" : "点击切换"}
              </div>
            </Link>
          ))}
        </div>

        {/* 中：编辑表单 */}
        <div>
          <div className="card" style={{ marginBottom: 14 }}>
            <label className="field">
              <span>路径标题</span>
              <input className="inp" value={meta.title} onChange={(e) => setMetaField("title", e.target.value)} />
            </label>
            <label className="field">
              <span>摘要（显示在路径卡上）</span>
              <input className="inp" value={meta.summary} onChange={(e) => setMetaField("summary", e.target.value)} />
            </label>
            <div className="grid cols-3">
              <label className="field">
                <span>预计耗时(分)</span>
                <input className="inp" type="number" value={meta.estMinutes} onChange={(e) => setMetaField("estMinutes", e.target.value)} />
              </label>
              <label className="field">
                <span>难度</span>
                <select className="inp" value={meta.level} onChange={(e) => setMetaField("level", e.target.value)}>
                  <option value="">—</option>
                  <option>入门</option>
                  <option>进阶</option>
                  <option>熟练</option>
                </select>
              </label>
              <label className="field">
                <span>适用角色</span>
                <select className="inp" value={meta.forRole} onChange={(e) => setMetaField("forRole", e.target.value)}>
                  <option value="">—</option>
                  <option>老师</option>
                  <option>学生</option>
                  <option>家长</option>
                  <option>学校管理员</option>
                </select>
              </label>
            </div>
            <label className="field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={meta.isLibraryPick}
                onChange={(e) => setMetaField("isLibraryPick", e.target.checked)}
              />
              <span style={{ margin: 0 }}>设为「用法库」精选（前台用法库会展示）</span>
            </label>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: "4px 0" }}>步骤（{steps.length}）</h3>
            <button className="btn sm" onClick={addStep}>
              + 添加步骤
            </button>
          </div>

          {steps.map((s, i) => (
            <div className="step-card" key={i}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <span className="step-no">#{i + 1}</span>
                  <input
                    className="inp"
                    style={{ width: 320, display: "inline-block" }}
                    placeholder="动作(action)"
                    value={s.action}
                    onChange={(e) => setStep(i, "action", e.target.value)}
                  />
                </div>
                <button className="btn sm danger" onClick={() => removeStep(i)}>
                  删除
                </button>
              </div>
              <label className="field" style={{ marginTop: 8 }}>
                <span>目标(goal)</span>
                <input className="inp" value={s.goal} onChange={(e) => setStep(i, "goal", e.target.value)} />
              </label>
              <label className="field">
                <span>提示词(prompt，用 {"{{变量}}"} 占位)</span>
                <textarea className="inp" value={s.prompt} onChange={(e) => setStep(i, "prompt", e.target.value)} />
              </label>
              <label className="field">
                <span>示例产出(outputSample)</span>
                <textarea className="inp" value={s.outputSample} onChange={(e) => setStep(i, "outputSample", e.target.value)} />
              </label>
              <div className="grid cols-2">
                <label className="field">
                  <span>媒体类型</span>
                  <select className="inp" value={s.mediaType} onChange={(e) => setStep(i, "mediaType", e.target.value)}>
                    <option value="">无</option>
                    <option value="image">image</option>
                    <option value="video">video</option>
                    <option value="file">file</option>
                  </select>
                </label>
                <label className="field">
                  <span>媒体说明</span>
                  <input className="inp" value={s.mediaLabel} onChange={(e) => setStep(i, "mediaLabel", e.target.value)} />
                </label>
              </div>
              <label className="field">
                <span>技巧(tip，绿框)</span>
                <textarea className="inp" value={s.tip} onChange={(e) => setStep(i, "tip", e.target.value)} />
              </label>
              <label className="field">
                <span>避坑(pitfall，红框)</span>
                <textarea className="inp" value={s.pitfall} onChange={(e) => setStep(i, "pitfall", e.target.value)} />
              </label>
              <label className="field">
                <span>分支(branch，JSON: [{"{"}"when","then"{"}"}])</span>
                <textarea className="inp" value={s.branchText} onChange={(e) => setStep(i, "branchText", e.target.value)} />
              </label>
            </div>
          ))}

          {err && <div style={{ color: "var(--danger)", fontSize: 13 }}>{err}</div>}
          <button className="btn primary" onClick={save} disabled={saving} style={{ marginTop: 8 }}>
            {saving ? "保存中…" : "保存 SOP"}
          </button>
        </div>

        {/* 右：实时预览（admin 内简化版，结构对齐前台 SopPathView） */}
        <div className="card preview">
          <div className="nav-group" style={{ padding: "0 4px" }}>实时预览（前台效果近似）</div>
          <h3 style={{ marginTop: 4 }}>{meta.title || "未命名路径"}</h3>
          {meta.summary && <p style={{ color: "var(--muted)", marginTop: 0 }}>{meta.summary}</p>}
          <div style={{ fontSize: 12, color: "var(--muted)" }}>
            {meta.level && <span className="badge">{meta.level}</span>} {meta.forRole && <span className="badge">{meta.forRole}</span>}{" "}
            {meta.estMinutes && `${meta.estMinutes} 分钟`}
            {meta.isLibraryPick && <span className="badge ok" style={{ marginLeft: 6 }}>用法库精选</span>}
          </div>
          <div style={{ marginTop: 12 }}>
            {steps.map((s, i) => (
              <div className="step-card" key={i} style={{ boxShadow: "none" }}>
                <div>
                  <span className="step-no">#{i + 1}</span>
                  <b>{s.action}</b>
                </div>
                {s.goal && <div className="goal">{s.goal}</div>}
                {s.prompt && <pre className="prompt">{highlightPrompt(s.prompt)}</pre>}
                {s.outputSample && <div style={{ fontSize: 12.5, color: "#334155" }}>{s.outputSample}</div>}
                {s.mediaLabel && <div className="badge" style={{ marginTop: 6 }}>媒体：{s.mediaLabel}</div>}
                {s.tip && <div className="box-tip">技巧：{s.tip}</div>}
                {s.pitfall && <div className="box-pit">避坑：{s.pitfall}</div>}
                {s.branchText.trim() &&
                  (() => {
                    try {
                      const branches = JSON.parse(s.branchText);
                      return (
                        <div className="box-branch">
                          分支：
                          {branches.map((b: { when: string; then: string }, bi: number) => (
                            <div key={bi}>
                              · 当「{b.when}」→ {b.then}
                            </div>
                          ))}
                        </div>
                      );
                    } catch {
                      return null;
                    }
                  })()}
              </div>
            ))}
            {steps.length === 0 && <div className="empty">暂无步骤</div>}
          </div>
        </div>
      </div>
    </>
  );
}
