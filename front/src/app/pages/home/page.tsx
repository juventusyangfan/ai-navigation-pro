"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { content, type Role, type Tool, type Usage, type Scene, roleClass, pricingLabel } from "@/lib/content";
import { Icon } from "@/lib/icons";
import FavButton from "@/components/FavButton";
import ToolLogo from "@/components/ToolLogo";

const ROLE_TABS: { key: "all" | Role; label: string }[] = [
  { key: "all", label: "全部角色" },
  { key: "老师", label: "老师" },
  { key: "学生", label: "学生" },
  { key: "家长", label: "家长" },
];

const HOT_SCENE_KEYS = [
  "beikeguihua",
  "kejian",
  "zuoye",
  "xueqing",
  "jiaxiao",
  "zixue",
  "keti",
  "shijian",
];

export default function HomePage() {
  const router = useRouter();
  const [activeRole, setActiveRole] = useState<"all" | Role>("all");
  const [q, setQ] = useState("");

  const [scenes, setScenes] = useState<Scene[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [usages, setUsages] = useState<Usage[]>([]);
  useEffect(() => {
    content.getScenes().then(setScenes);
    content.getTools().then(setTools);
    content.getUsages().then(setUsages);
  }, []);

  const toolsByScene = (key: string) => tools.filter((t) => t.scenes.includes(key));

  const filteredScenes = scenes.filter((s) => {
    if (activeRole === "all") return true;
    return s.roles.includes(activeRole);
  });

  const hotUsages = usages
    .filter((u) => u.pick)
    .sort((a, b) => b.useful - a.useful)
    .slice(0, 3);

  const hotTools = [...tools]
    .filter((t) => t.paths.length > 0)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 6);

  const latestTools = [...tools]
    .filter((t) => t.paths.length > 0)
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 6);

  return (
    <main>
      {/* Hero */}
      <section className="hero">
        <div className="wrap">
          <h1>
            老师家长的 <span className="hl">AI 工具地图</span>
            <br />
            不止找到，更教你怎么用
          </h1>
          <p>
            按角色与教学场景整理 AI
            工具，每个工具都配「分步使用路径 + 可复制提示词」，让 AI 真正落进课堂。
          </p>
          <form
            className="hero-search"
            onSubmit={(e) => {
              e.preventDefault();
              if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
            }}
          >
            <div className="searchbar" style={{ width: "100%" }}>
              <Icon name="MagnifyingGlass" size={16} className="text-muted" />
              <input
                name="q"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="试试搜：初三数学 / 评语 / 课件"
              />
            </div>
            <button className="btn btn-primary" type="submit">
              搜索
            </button>
          </form>
          <div className="hero-chips">
            {HOT_SCENE_KEYS.slice(0, 6).map((key) => {
              const scene = scenes.find((s) => s.key === key);
              if (!scene) return null;
              return (
                <Link key={key} href={`/scenes/${key}`} className="chip">
                  {scene.name}
                </Link>
              );
            })}
          </div>
          <div className="term-prompt">
            <span className="tp-arrow">
              <Icon name="CaretRight" size={12} />
            </span>{" "}
            试试说「帮我找能做课件的 AI 工具」
            <span className="tp-cursor"></span>
          </div>
        </div>
      </section>

      {/* Stats Ticker */}
      <div className="wrap">
        <div className="stats-ticker">
          <div className="st-item">
            <div className="st-val">{tools.length}</div>
            <div className="st-lbl">收录工具</div>
          </div>
          <div className="st-item">
            <div className="st-val">{usages.length}</div>
            <div className="st-lbl">使用路径 SOP</div>
          </div>
          <div className="st-item">
            <div className="st-val">{scenes.length}</div>
            <div className="st-lbl">教学场景</div>
          </div>
          <div className="st-item">
            <div className="st-val">3</div>
            <div className="st-lbl">覆盖角色</div>
          </div>
        </div>
      </div>

      {/* Scenes Section */}
      <section className="block" style={{ paddingTop: "28px" }}>
        <div className="wrap">
          <div className="sec-head">
            <div>
              <h2>按教学场景找工具</h2>
              <div className="sub">先选身份，再挑场景：点卡片直达对应工具</div>
            </div>
            <Link href="/scenes" className="link-more">
              查看全部场景 <Icon name="ArrowRight" size={12} className="inline" />
            </Link>
          </div>

          <div className="role-tabs" style={{ margin: "6px 0 18px" }}>
            {ROLE_TABS.map((tab) => (
              <button
                key={tab.key}
                className={activeRole === tab.key ? "active" : ""}
                onClick={() => setActiveRole(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="bento-grid">
            {filteredScenes.map((scene) => {
              const sceneTools = toolsByScene(scene.key);
              const roleBadges = scene.roles.map((r) => (
                <span key={r} className={`rb rb-${roleClass(r)}`}>
                  {r}
                </span>
              ));
              const repTools = sceneTools.slice(0, 2);
              const sopCount = usages.filter((u) => u.scene === scene.key).length;

              return (
                <div
                  key={scene.key}
                  className="scene-card"
                  data-roles={scene.roles.join(",")}
                >
                  <Link className="sc-main" href={`/scenes/${scene.key}`}>
                    <div className="ic">
                      <Icon name={scene.icon} size={24} />
                    </div>
                    <h3>{scene.name}</h3>
                    <div className="cnt">{sceneTools.length} 个工具</div>
                    <span className="arrow">
                      <Icon name="ArrowRight" size={14} />
                    </span>
                  </Link>
                  <div className="scene-roles">{roleBadges}</div>
                  {repTools.length > 0 && (
                    <div className="scene-rep">
                      代表工具：
                      {repTools.map((t, i) => (
                        <span key={t.slug} className="rt">
                          {t.name}
                          {i < repTools.length - 1 ? "" : ""}
                        </span>
                      ))}
                    </div>
                  )}
                  {sopCount > 0 && (
                    <Link
                      className="scene-sop-link"
                      href={`/usages?scene=${scene.key}`}
                    >
                      <Icon name="Notebook" size={14} className="inline" /> {sopCount} 个用法 SOP{" "}
                      <Icon name="ArrowRight" size={12} className="inline" />
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="wrap">
        <div className="divider-geo"></div>
      </div>

      {/* Spotlight */}
      <section className="block" style={{ paddingTop: "28px" }}>
        <div className="wrap">
          <div className="sec-head">
            <div>
              <h2>精选用法推荐</h2>
              <div className="sub">帮你看到工具怎么真正用起来</div>
            </div>
            <Link href="/usages" className="link-more">
              逛用法库 <Icon name="ArrowRight" size={12} className="inline" />
            </Link>
          </div>
          <div className="spotlight">
            {hotUsages[0] && (
              <Link
                className="spotlight-main"
                href={`/usages/${hotUsages[0].id}`}
              >
                <span className="sm-label">◆ 编辑精选</span>
                <h3>{hotUsages[0].title}</h3>
                <p>{hotUsages[0].summary}</p>
                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    alignItems: "center",
                    marginTop: "4px",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "12px",
                      color: "var(--primary)",
                    }}
                  >
                    {hotUsages[0].steps} 步操作
                  </span>
                  <span style={{ color: "var(--muted)" }}>·</span>
                  <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                    {tools.find((t) => t.slug === hotUsages[0].tool)?.name ||
                      hotUsages[0].tool}
                  </span>
                </div>
              </Link>
            )}
            <div className="spotlight-side">
              {hotUsages.slice(1).map((usage, idx) => (
                <Link
                  key={usage.id}
                  className="ss-card"
                  href={`/usages/${usage.id}`}
                >
                  <div className="ss-num">{String(idx + 3).padStart(2, "0")}</div>
                  <h4>{usage.title}</h4>
                  <p>
                    {tools.find((t) => t.slug === usage.tool)?.name || usage.tool} ·{" "}
                    {usage.subj}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* AI Literacy CTA */}
      <section className="block" style={{ paddingTop: "10px" }}>
        <div className="wrap">
          <Link className="feat-cta" href="/literacy">
            <div className="feat-cta-l">
              <span className="feat-ico">
                <Icon name="GraduationCap" size={22} />
              </span>
              <div>
                <b>AI通识课 · 系统学 AI 基础</b>
                <div
                  className="muted"
                  style={{ fontWeight: 400, fontSize: "12.5px" }}
                >
                  从「什么是大模型」→「提示词」→「伦理安全」→「学科应用」，一套渐进式学习路径，配工具与 SOP。
                </div>
              </div>
            </div>
            <span className="feat-go">
              开始学习 <Icon name="ArrowRight" size={12} className="inline" />
            </span>
          </Link>
        </div>
      </section>

      {/* Hot Tools */}
      <section className="block">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <h2>热门用法工具</h2>
              <div className="sub">老师们正在用这些提效</div>
            </div>
            <Link href="/tools" className="link-more">
              查看全部工具 <Icon name="ArrowRight" size={12} className="inline" />
            </Link>
          </div>
          <div className="tool-grid">
            {hotTools.map((tool) => {
              const sopCount = tool.paths.length;
              return (
                <div key={tool.slug} className="tool-card">
                  <FavButton slug={tool.slug} name={tool.name} />
                  <Link className="tool-top" href={`/tool/${tool.slug}`}>
                    <div className="tool-logo">
                      <ToolLogo logo={tool.logo} name={tool.name} color={tool.color} />
                    </div>
                    <div>
                      <div className="tool-name">{tool.name}</div>
                      <div className="tool-tagline">{tool.tagline}</div>
                    </div>
                  </Link>
                  <div>
                    {tool.roles.map((r) => (
                      <span key={r} className="tag role">
                        {r}
                      </span>
                    ))}
                  </div>
                  <div className="tool-meta">
                    {tool.scenes.map((sceneKey) => {
                      const scene = scenes.find((s) => s.key === sceneKey);
                      if (!scene) return null;
                      return (
                        <Link
                          key={sceneKey}
                          className="tag scene"
                          href={`/scenes/${sceneKey}`}
                        >
                          {scene.name}
                        </Link>
                      );
                    })}
                    <span className={`price ${tool.pricing}`}>
                      {pricingLabel(tool.pricing)}
                    </span>
                  </div>
                  {sopCount > 0 && (
                    <div style={{ marginTop: "4px" }}>
                      <span className="tool-sop-badge">
                        <Icon name="Notebook" size={13} className="inline" /> 含 {sopCount} 条使用路径
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Latest Tools */}
      <section className="block">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <h2>最新收录</h2>
            </div>
            <Link href="/submit" className="link-more">
              投稿工具 <Icon name="ArrowRight" size={12} className="inline" />
            </Link>
          </div>
          <div className="tool-grid">
            {latestTools.map((tool) => {
              const sopCount = tool.paths.length;
              return (
                <div key={tool.slug} className="tool-card">
                  <FavButton slug={tool.slug} name={tool.name} />
                  <Link className="tool-top" href={`/tool/${tool.slug}`}>
                    <div className="tool-logo">
                      <ToolLogo logo={tool.logo} name={tool.name} color={tool.color} />
                    </div>
                    <div>
                      <div className="tool-name">{tool.name}</div>
                      <div className="tool-tagline">{tool.tagline}</div>
                    </div>
                  </Link>
                  <div>
                    {tool.roles.map((r) => (
                      <span key={r} className="tag role">
                        {r}
                      </span>
                    ))}
                  </div>
                  <div className="tool-meta">
                    {tool.scenes.map((sceneKey) => {
                      const scene = scenes.find((s) => s.key === sceneKey);
                      if (!scene) return null;
                      return (
                        <Link
                          key={sceneKey}
                          className="tag scene"
                          href={`/scenes/${sceneKey}`}
                        >
                          {scene.name}
                        </Link>
                      );
                    })}
                    <span className={`price ${tool.pricing}`}>
                      {pricingLabel(tool.pricing)}
                    </span>
                  </div>
                  {sopCount > 0 && (
                    <div style={{ marginTop: "4px" }}>
                      <span className="tool-sop-badge">
                        <Icon name="Notebook" size={13} className="inline" /> 含 {sopCount} 条使用路径
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Email Subscribe */}
      <section className="block">
        <div className="wrap">
          <div
            className="card"
            style={{
              background: "var(--primary-soft)",
              borderColor: "rgba(0,204,255,.15)",
            }}
          >
            <h3 style={{ color: "var(--primary)" }}>
              <Icon name="Envelope" size={18} className="inline" /> 每周一封「新工具 + 一个用法 SOP」
            </h3>
            <p className="muted" style={{ margin: "6px 0 14px" }}>
              留下邮箱，跟上 AI 助教的最前线。
            </p>
            <form
              className="hero-search"
              onSubmit={(e) => {
                e.preventDefault();
              }}
            >
              <div className="searchbar" style={{ width: "100%" }}>
                <Icon name="EnvelopeSimple" size={16} className="text-muted" />
                <input placeholder="you@school.edu.cn" />
              </div>
              <button className="btn btn-primary" type="submit">
                订阅
              </button>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
