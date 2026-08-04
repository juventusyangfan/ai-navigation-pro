"use client";

import { Suspense, useState, useEffect, type FormEvent } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { content, type Tool, type Usage, type Scene } from "@/lib/content";
import ToolCard from "@/components/ToolCard";
import SceneCard from "@/components/SceneCard";
import { Icon } from "@/lib/icons";

function SearchInner() {
  const params = useSearchParams();
  const router = useRouter();
  const q = (params.get("q") || "").trim();
  const [val, setVal] = useState(q);

  const [tools, setTools] = useState<Tool[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [usages, setUsages] = useState<Usage[]>([]);
  const [sceneName, setSceneName] = useState<Record<string, string>>({});
  const [toolMap, setToolMap] = useState<Record<string, Tool>>({});
  useEffect(() => {
    content.getTools().then(setTools);
    content.getScenes().then(setScenes);
    content.getUsages().then(setUsages);
    content.getSceneName().then(setSceneName);
    content.getToolMap().then(setToolMap);
  }, []);

  const toolsByScene = (key: string) => tools.filter((t) => t.scenes.includes(key));

  const ql = q.toLowerCase();
  const hitTools: Tool[] = q
    ? tools.filter((t) =>
        [
          t.name,
          t.tagline,
          t.subjects.join(" "),
          t.roles.join(" "),
          t.scenes.map((s) => sceneName[s] || s).join(" "),
          t.slug,
        ]
          .join(" ")
          .toLowerCase()
          .includes(ql),
      )
    : [];
  const hitScenes = q
    ? scenes.filter((s) =>
        [s.name, s.key, s.roles.join(" "), s.key].join(" ").toLowerCase().includes(ql),
      )
    : [];
  const hitUsages: Usage[] = q
    ? usages.filter((u) =>
        [u.title, u.summary, u.subj, u.role, toolMap[u.tool]?.name || ""]
          .join(" ")
          .toLowerCase()
          .includes(ql),
      )
    : [];

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const v = val.trim();
    if (v) router.push(`/search?q=${encodeURIComponent(v)}`);
  };

  const total = hitTools.length + hitScenes.length + hitUsages.length;

  return (
    <main>
      <section className="block">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <h1>搜索</h1>
              <div className="sub">
                {q ? (
                  <>
                    找到 <b>{total}</b> 个与「{q}」相关的结果
                  </>
                ) : (
                  "搜工具、教学场景、用法 SOP"
                )}
              </div>
            </div>
          </div>

          <form className="hero-search" onSubmit={submit}>
            <div className="searchbar" style={{ width: "100%", maxWidth: 640 }}>
              <Icon name="MagnifyingGlass" size={16} className="text-muted" />
              <input
                value={val}
                onChange={(e) => setVal(e.target.value)}
                placeholder="试试搜：初三数学 / 评语 / 课件 / 豆包"
              />
            </div>
            <button className="btn btn-primary" type="submit">
              搜索
            </button>
          </form>

          {!q && (
            <div className="empty" style={{ marginTop: 24 }}>
              <div className="big">
                <Icon name="MagnifyingGlass" size={40} />
              </div>
              输入关键词开始搜索
            </div>
          )}

          {q && total === 0 && (
            <div className="empty" style={{ marginTop: 24 }}>
              <div className="big">
                <Icon name="FolderOpen" size={40} />
              </div>
              没有找到与「{q}」相关的内容，换个词试试。
            </div>
          )}

          {hitTools.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <div className="sec-head">
                <h2>工具 · {hitTools.length}</h2>
              </div>
              <div className="tool-grid">
                {hitTools.map((t) => (
                  <ToolCard key={t.slug} tool={t} />
                ))}
              </div>
            </div>
          )}

          {hitScenes.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <div className="sec-head">
                <h2>教学场景 · {hitScenes.length}</h2>
              </div>
              <div className="bento-grid">
                {hitScenes.map((s) => (
                  <SceneCard
                    key={s.key}
                    scene={s}
                    rep={toolsByScene(s.key).slice(0, 2)}
                    sopN={usages.filter((u) => u.scene === s.key).length}
                  />
                ))}
              </div>
            </div>
          )}

          {hitUsages.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <div className="sec-head">
                <h2>用法 SOP · {hitUsages.length}</h2>
              </div>
              <div className="pb-grid">
                {hitUsages.map((u) => (
                  <div className="pb-card" key={u.id}>
                    <div className="pb-top">
                      <span className="pb-cat">{sceneName[u.scene] || u.scene}</span>
                      {u.pick && (
                        <span className="editor-pick">
                          <Icon name="Star" size={10} weight="fill" className="inline" /> 编辑精选
                        </span>
                      )}
                    </div>
                    <h3>
                      <Link href={`/usages/${u.id}`}>{u.title}</Link>
                    </h3>
                    <p>{u.summary}</p>
                    <div className="pb-tags">
                      <span className="tag">{toolMap[u.tool]?.name}</span>
                      <span className="tag subj">{u.subj}</span>
                      <span className="tag">
                        <Icon name="ClipboardText" size={11} className="inline" /> {u.steps} 步
                      </span>
                    </div>
                    <div className="sp-row">
                      <Link href={`/usages/${u.id}`} className="sp-btn">
                        看用法 <b><Icon name="ArrowRight" size={12} /></b>
                      </Link>
                      <Link href={`/scenes/${u.scene}`} className="sp-btn">
                        看场景 <b><Icon name="ArrowRight" size={12} /></b>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="wrap"><div className="empty">加载中…</div></div>}>
      <SearchInner />
    </Suspense>
  );
}
