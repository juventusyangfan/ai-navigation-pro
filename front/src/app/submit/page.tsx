"use client";

import { useState, useEffect } from "react";
import { content, type Scene } from "@/lib/content";
import { Icon } from "@/lib/icons";
import { isImageLogo } from "@/lib/logo";
import TagInput from "@/components/TagInput";

const ROLE_OPTIONS = ["老师", "学生", "家长", "学校管理员"] as const;
const PRICING_OPTIONS = [
  { value: "Free", label: "免费" },
  { value: "Freemium", label: "免费+增值" },
  { value: "Paid", label: "付费" },
  { value: "Enterprise", label: "企业版" },
];
const LEVEL_OPTIONS = ["入门", "进阶", "熟练"] as const;
const SUBJECT_SUGGESTIONS = [
  "语文", "数学", "英语", "物理", "化学", "生物",
  "历史", "地理", "政治", "科学", "信息技术", "综合", "通用",
];
const PLATFORM_SUGGESTIONS = ["网页", "APP", "小程序", "插件", "API", "桌面"];

interface Step {
  id: string;
  goal: string;
  action: string;
  prompt: string;
  outputSample: string;
  pitfall: string;
  tip: string;
}
interface Path {
  id: string;
  title: string;
  level: string;
  forRole: string;
  steps: Step[];
}

const uid = () =>
  (typeof crypto !== "undefined" && crypto.randomUUID?.()) || Math.random().toString(36).slice(2, 10);

const blankStep = (): Step => ({
  id: uid(),
  goal: "", action: "", prompt: "", outputSample: "", pitfall: "", tip: "",
});
const blankPath = (): Path => ({
  id: uid(), title: "", level: "入门", forRole: "", steps: [blankStep()],
});

function submitUrl(): string {
  const base = process.env.NEXT_PUBLIC_API_BASE ?? "";
  return `${base}/api/me/submissions`;
}

export default function SubmitPage() {
  const [scenes, setScenes] = useState<Scene[]>([]);
  useEffect(() => {
    content.getScenes().then(setScenes).catch(() => setScenes([]));
  }, []);

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [logo, setLogo] = useState("");
  const [tagline, setTagline] = useState("");
  const [roles, setRoles] = useState<string[]>([]);
  const [selectedScenes, setSelectedScenes] = useState<string[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [pricing, setPricing] = useState("Freemium");
  const [platform, setPlatform] = useState("");
  const [compliance, setCompliance] = useState("");
  const [pros, setPros] = useState<string[]>([]);
  const [cons, setCons] = useState<string[]>([]);
  const [alts, setAlts] = useState<string[]>([]);
  const [paths, setPaths] = useState<Path[]>([blankPath()]);

  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ id: string } | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [draftJson, setDraftJson] = useState<string | null>(null);

  const toggle = (list: string[], v: string): string[] =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

  const updatePath = (id: string, patch: Partial<Path>) =>
    setPaths((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const updateStep = (pid: string, sid: string, patch: Partial<Step>) =>
    setPaths((ps) =>
      ps.map((p) =>
        p.id === pid
          ? { ...p, steps: p.steps.map((s) => (s.id === sid ? { ...s, ...patch } : s)) }
          : p,
      ),
    );

  const buildPayload = () => ({
    tool: {
      name: name.trim(),
      url: url.trim(),
      logo: logo.trim(),
      tagline: tagline.trim(),
      roles,
      scenes: selectedScenes,
      subjects,
      pricing,
      platform: platform.trim(),
      compliance: compliance.trim(),
      pros,
      cons,
      alts,
    },
    paths: paths
      .filter((p) => p.title.trim() || p.steps.some((s) => s.action.trim() || s.prompt.trim()))
      .map((p) => ({
        title: p.title.trim(),
        level: p.level,
        forRole: p.forRole || undefined,
        steps: p.steps
          .filter((s) => s.action.trim() || s.prompt.trim())
          .map((s) => ({
            goal: s.goal.trim() || undefined,
            action: s.action.trim(),
            prompt: s.prompt.trim(),
            outputSample: s.outputSample.trim() || undefined,
            pitfall: s.pitfall.trim() || undefined,
            tip: s.tip.trim() || undefined,
          })),
      })),
    submitter: (() => {
      try {
        const u = JSON.parse(localStorage.getItem("ea_user") || "{}");
        return { name: u.name || "匿名", role: u.role || "" };
      } catch {
        return { name: "匿名", role: "" };
      }
    })(),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: string[] = [];
    if (!name.trim()) errs.push("请填写工具名称");
    if (!url.trim()) errs.push("请填写官网链接");
    else if (!/^https?:\/\//i.test(url.trim())) errs.push("官网链接必须以 http(s):// 开头");
    if (roles.length === 0) errs.push("请至少选择一个适用角色");
    if (selectedScenes.length === 0) errs.push("请至少选择一个适用场景");
    if (errs.length) {
      setErrors(errs);
      return;
    }
    setErrors([]);
    setServerError(null);
    setSubmitting(true);
    const payload = buildPayload();
    try {
      const res = await fetch(submitUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "tool", payload }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setDone({ id: data.id });
        setDraftJson(null);
      } else {
        setServerError(data.error || "提交失败，请稍后重试");
        setDraftJson(JSON.stringify(payload, null, 2));
      }
    } catch {
      setServerError("无法连接到服务，您可复制下方草稿稍后提交");
      setDraftJson(JSON.stringify(payload, null, 2));
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <main className="wrap">
        <div className="form-wrap" style={{ marginTop: 30, textAlign: "center" }}>
          <div className="card">
            <div className="ic" style={{ color: "var(--color-primary)" }}>
              <Icon name="CheckCircle" size={40} />
            </div>
            <h2>投稿已提交</h2>
            <p className="muted">
              编号 <b>#{done.id}</b> · 状态：<b>待审核</b>
            </p>
            <p className="text-muted" style={{ marginTop: 8 }}>
              编辑审核通过后，工具将出现在对应场景；含使用路径的投稿会被优先收录。
            </p>
            <a className="btn btn-primary btn-block" href="/" style={{ marginTop: 16 }}>
              返回首页
            </a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="wrap">
      <div className="form-wrap" style={{ marginTop: 30 }}>
        <div className="sec-head">
          <div>
            <h2>投稿一个 AI 工具</h2>
            <div className="sub">审核通过后将在对应场景展示，并优先收录使用路径 SOP</div>
          </div>
        </div>
        <div className="form-note">
          <span className="ic">
            <Icon name="Info" size={16} />
          </span>
          <span>
            收录流程：<b>提交 → 编辑审核 → 发布 / 驳回</b>。若含 affiliate 链接将明确标注，绝不误导。
          </span>
        </div>

        {errors.length > 0 ? (
          <div className="form-errors">
            {errors.map((e) => (
              <div key={e}>· {e}</div>
            ))}
          </div>
        ) : null}
        {serverError ? (
          <div className="form-errors">{serverError}</div>
        ) : null}

        <form onSubmit={handleSubmit}>
          {/* 基础信息 */}
          <h3 className="form-section">基础信息</h3>
          <div className="field">
            <label>工具名称 <span className="req">*</span></label>
            <input placeholder="如：秘塔写作猫" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label>官网链接 <span className="req">*</span></label>
            <input placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} />
          </div>
          <div className="field">
            <label>Logo 图片链接</label>
            <input
              placeholder="https://.../favicon.ico 或品牌 logo 地址"
              value={logo}
              onChange={(e) => setLogo(e.target.value)}
            />
            {isImageLogo(logo) ? (
              <div className="logo-preview">
                <img src={logo} alt="logo 预览" onError={(e) => (e.currentTarget.style.display = "none")} />
                <span className="muted">预览（审核通过后展示）</span>
              </div>
            ) : null}
          </div>
          <div className="field">
            <label>一句话定位</label>
            <input placeholder="它最擅长解决什么" value={tagline} onChange={(e) => setTagline(e.target.value)} />
          </div>

          <div className="field">
            <label>
              适用角色 <span className="req">*</span>
              <span className="hint">可多选</span>
            </label>
            <div className="chip-row">
              {ROLE_OPTIONS.map((r) => (
                <button
                  type="button"
                  key={r}
                  className={`chip ${roles.includes(r) ? "chip-on" : ""}`}
                  onClick={() => setRoles((p) => toggle(p, r))}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label>
              适用场景 <span className="req">*</span>
              <span className="hint">可多选</span>
            </label>
            <div className="chip-row">
              {scenes.map((s) => (
                <button
                  type="button"
                  key={s.key}
                  className={`chip ${selectedScenes.includes(s.key) ? "chip-on" : ""}`}
                  onClick={() => setSelectedScenes((p) => toggle(p, s.key))}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>

          <TagInput
            label="适用学科"
            hint="可多选"
            placeholder="输入学科后回车"
            values={subjects}
            onChange={setSubjects}
            suggestions={SUBJECT_SUGGESTIONS}
          />

          <div className="field">
            <label>收费模式</label>
            <select value={pricing} onChange={(e) => setPricing(e.target.value)}>
              {PRICING_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>支持平台</label>
            <input
              placeholder="如：网页 / APP / 插件"
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
            />
            <div className="tag-suggest">
              {PLATFORM_SUGGESTIONS.filter((s) => !platform.includes(s)).map((s) => (
                <button
                  type="button"
                  key={s}
                  className="tag-suggest-item"
                  onClick={() => setPlatform((p) => (p ? `${p} / ${s}` : s))}
                >
                  + {s}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label>合规 / 隐私说明</label>
            <textarea
              placeholder="如：需登录使用；数据本地处理；适合未成年人使用等"
              value={compliance}
              onChange={(e) => setCompliance(e.target.value)}
            />
          </div>

          {/* 亮点与对比 */}
          <h3 className="form-section">亮点与对比</h3>
          <TagInput label="核心亮点（pros）" placeholder="输入后回车" values={pros} onChange={setPros} />
          <TagInput label="主要不足（cons）" placeholder="输入后回车" values={cons} onChange={setCons} />
          <TagInput
            label="替代工具"
            hint="同赛道其他产品名"
            placeholder="输入后回车"
            values={alts}
            onChange={setAlts}
          />

          {/* 使用路径 SOP */}
          <h3 className="form-section">使用路径 SOP（可选，优先收录）</h3>
          {paths.map((p, pi) => (
            <div className="path-card" key={p.id}>
              <div className="path-head">
                <b>路径 {pi + 1}</b>
                {paths.length > 1 ? (
                  <button type="button" className="link-del" onClick={() => setPaths((ps) => ps.filter((x) => x.id !== p.id))}>
                    删除路径
                  </button>
                ) : null}
              </div>
              <div className="field">
                <label>路径标题</label>
                <input
                  placeholder="如：用洋葱学园讲解一个难点"
                  value={p.title}
                  onChange={(e) => updatePath(p.id, { title: e.target.value })}
                />
              </div>
              <div className="field-row">
                <div className="field">
                  <label>难度</label>
                  <select value={p.level} onChange={(e) => updatePath(p.id, { level: e.target.value })}>
                    {LEVEL_OPTIONS.map((l) => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>面向角色</label>
                  <select value={p.forRole} onChange={(e) => updatePath(p.id, { forRole: e.target.value })}>
                    <option value="">通用</option>
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>

              {p.steps.map((s, si) => (
                <div className="step-card" key={s.id}>
                  <div className="path-head">
                    <b>步骤 {si + 1}</b>
                    {p.steps.length > 1 ? (
                      <button
                        type="button"
                        className="link-del"
                        onClick={() => updatePath(p.id, { steps: p.steps.filter((x) => x.id !== s.id) })}
                      >
                        删除步骤
                      </button>
                    ) : null}
                  </div>
                  <div className="field">
                    <label>目标（可选）</label>
                    <input placeholder="这一步要达成什么" value={s.goal} onChange={(e) => updateStep(p.id, s.id, { goal: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>操作 <span className="req">*</span></label>
                    <input placeholder="在工具里做什么" value={s.action} onChange={(e) => updateStep(p.id, s.id, { action: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>提示词（prompt） <span className="req">*</span></label>
                    <textarea placeholder="可直接复制的提示词" value={s.prompt} onChange={(e) => updateStep(p.id, s.id, { prompt: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>产出样例（可选）</label>
                    <textarea placeholder="期望得到的输出" value={s.outputSample} onChange={(e) => updateStep(p.id, s.id, { outputSample: e.target.value })} />
                  </div>
                  <div className="field-row">
                    <div className="field">
                      <label>注意（可选）</label>
                      <input placeholder="常见坑" value={s.pitfall} onChange={(e) => updateStep(p.id, s.id, { pitfall: e.target.value })} />
                    </div>
                    <div className="field">
                      <label>技巧（可选）</label>
                      <input placeholder="小技巧" value={s.tip} onChange={(e) => updateStep(p.id, s.id, { tip: e.target.value })} />
                    </div>
                  </div>
                </div>
              ))}
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => updatePath(p.id, { steps: [...p.steps, blankStep()] })}>
                + 添加步骤
              </button>
            </div>
          ))}
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPaths((ps) => [...ps, blankPath()])}>
            + 添加使用路径
          </button>

          <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
            {submitting ? "提交中…" : "提交投稿"}
          </button>

          {draftJson ? (
            <div className="draft-box">
              <p className="muted">投稿通道暂未就绪，您可复制以下草稿留存，待开放后提交：</p>
              <pre>{draftJson}</pre>
            </div>
          ) : null}
        </form>
      </div>
    </main>
  );
}
