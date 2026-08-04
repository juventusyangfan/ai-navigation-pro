"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  content,
  type Role,
  type Scene,
  type Tool,
  type Usage,
  type Cat,
  roleClass,
  CAT_ORDER,
} from "@/lib/content";
import { Icon } from "@/lib/icons";

const ROLE_TABS: { key: "all" | Role; label: string }[] = [
  { key: "all", label: "全部角色" },
  { key: "老师", label: "老师" },
  { key: "学生", label: "学生" },
  { key: "家长", label: "家长" },
  { key: "学校管理员", label: "学校管理员" },
];

const PHASES = [
  { num: "1", phase: "课前", name: "教学准备" },
  { num: "2", phase: "课中", name: "课堂教学" },
  { num: "3", phase: "课后", name: "评价协同" },
  { num: "4", phase: "发展", name: "成长教研" },
];

export default function ScenesPage() {
  const [activeRole, setActiveRole] = useState<"all" | Role>("all");

  const [scenes, setScenes] = useState<Scene[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [usages, setUsages] = useState<Usage[]>([]);
  const [categories, setCategories] = useState<Record<string, Cat>>({});
  useEffect(() => {
    content.getScenes().then(setScenes);
    content.getTools().then(setTools);
    content.getUsages().then(setUsages);
    content.getCategories().then(setCategories);
  }, []);

  const toolsByScene = (key: string) => tools.filter((t) => t.scenes.includes(key));
  const usagesForScene = (key: string) => usages.filter((u) => u.scene === key);

  return (
    <main className="wrap">
      {/* Hero */}
      <div className="scenes-hero">
        <h1>全部教学场景</h1>
        <p>
          按「教学全流程」组织：从课前备课，到课中教学，到课后评价协同，再到长期成长教研。先看你在哪个环节，再找对应的 AI 工具。
        </p>
        <div className="phase-spine">
          {PHASES.map((p, i) => (
            <div key={p.name} style={{ display: "inline-flex", alignItems: "center" }}>
              <a className="phase-chip" href={`#cat-${p.name}`}>
                <b>{p.num}</b>
                <span className="pc-phase">{p.phase}</span>
                <span className="pc-name">{p.name}</span>
              </a>
              {i < PHASES.length - 1 && (
                <span className="phase-arrow">
                  <Icon name="ArrowRight" size={14} />
                </span>
              )}
            </div>
          ))}
        </div>
        <div className="rel-banner">
          <Icon name="MagnifyingGlass" size={14} className="inline" /> <b>全部场景</b> 帮你按教学环节<b>找到工具</b>；想看老师亲测的<b>分步用法</b>，去{" "}
          <Link href="/usages">用法库 <Icon name="ArrowRight" size={12} className="inline" /></Link>
        </div>
      </div>

      {/* Role Tabs */}
      <div className="role-tabs" style={{ marginBottom: "18px" }}>
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

      <div className="scenes-layout">
        {/* Left Cat Nav */}
        <nav className="cat-nav">
          {CAT_ORDER.map((catKey, idx) => {
            const cat = categories[catKey];
            if (!cat) return null;
            return (
              <a key={catKey} href={`#cat-${catKey}`} data-cat={catKey}>
                <span className="cn">
                  <Icon name={cat.icon} size={18} />
                </span>
                <span className="cl">
                  <b>{idx + 1}</b> {catKey}
                  <small>{cat.phase}</small>
                </span>
              </a>
            );
          })}
        </nav>

        {/* Right Content */}
        <div>
          {/* Role Legend */}
          <div className="role-legend">
            适用角色：
            <span className="rb rb-teacher">老师</span>
            <span className="rb rb-student">学生</span>
            <span className="rb rb-parent">家长</span>
            <span className="rb rb-admin">学校管理员</span>
            <span className="muted">· 切换上方角色可筛选场景</span>
          </div>

          {CAT_ORDER.map((catKey, idx) => {
            const cat = categories[catKey];
            if (!cat) return null;
            const catScenes = scenes.filter(
              (s) => s.cat === catKey && (activeRole === "all" || s.roles.includes(activeRole))
            );

            if (catScenes.length === 0) return null;

            const totalTools = catScenes.reduce(
              (sum, s) => sum + toolsByScene(s.key).length,
              0
            );
            const totalSops = catScenes.reduce(
              (sum, s) => sum + usagesForScene(s.key).length,
              0
            );
            const allRoles = [...new Set(catScenes.flatMap((s) => s.roles))];

            return (
              <div key={catKey} className="cat-block" id={`cat-${catKey}`}>
                <div className="cat-head">
                  <span className="cat-step">{idx + 1}</span>
                  <div className="cat-htext">
                    <div className="cat-title">
                      <span className="ci">
                        <Icon name={cat.icon} size={20} />
                      </span>
                      {catKey}
                      <span className="cat-phase">{cat.phase}</span>
                    </div>
                    <p className="cat-desc">{cat.desc}</p>
                  </div>
                  <div className="cat-meta">
                    <span>
                      <Icon name="PuzzlePiece" size={13} className="inline" /> {catScenes.length} 个场景
                    </span>
                    <span>
                      <Icon name="Notebook" size={13} className="inline" /> {totalSops} 个 SOP
                    </span>
                    <span>
                      <Icon name="Users" size={13} className="inline" /> {allRoles.join("、")}
                    </span>
                  </div>
                </div>
                <div className="scene-grid">
                  {catScenes.map((scene) => {
                    const sceneTools = toolsByScene(scene.key);
                    const roleBadges = scene.roles.map((r) => (
                      <span key={r} className={`rb rb-${roleClass(r)}`}>
                        {r}
                      </span>
                    ));
                    const sopCount = usagesForScene(scene.key).length;

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
                          <div className="scene-roles">{roleBadges}</div>
                          <span className="arrow">
                            <Icon name="ArrowRight" size={14} />
                          </span>
                        </Link>
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
            );
          })}
        </div>
      </div>
    </main>
  );
}
