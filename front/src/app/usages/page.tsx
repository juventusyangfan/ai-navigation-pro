"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { content, type Role, type Tool, type Usage, type Scene, roleClass } from "@/lib/content";
import { Icon } from "@/lib/icons";
import UsageUsefulCollect from "@/components/UsageUsefulCollect";

type SortKey = "useful" | "collect" | "pick" | "new";

const SUBJECTS = ["全部", "综合", "语文", "数学", "英语"] as const;
const ROLES: ("all" | Role)[] = ["all", "老师", "学生", "家长"];
const SCENE_FILTERS = [
  { key: "all", label: "全部" },
  { key: "beikeguihua", label: "备课规划" },
  { key: "kejian", label: "课件制作" },
  { key: "zuoye", label: "作业考试" },
  { key: "xueqing", label: "学情评价" },
  { key: "jiaxiao", label: "家校班级" },
  { key: "zixue", label: "自学答疑" },
  { key: "keti", label: "教研课题" },
  { key: "shijian", label: "综合实践" },
];

function UsagesInner() {
  const [usages, setUsages] = useState<Usage[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  useEffect(() => {
    content.getUsages().then(setUsages);
    content.getScenes().then(setScenes);
    content.getTools().then(setTools);
  }, []);

  // A1 深链：从 URL 读取初始筛选，让 /usages?scene=xxx 等链接真正过滤
  const params = useSearchParams();
  const initialScene = params.get("scene") || "all";
  const initialRole = params.get("role") || "all";

  const [subject, setSubject] = useState<(typeof SUBJECTS)[number]>("全部");
  const [role, setRole] = useState<"all" | Role>(initialRole as "all" | Role);
  const [scene, setScene] = useState(initialScene);
  const [sort, setSort] = useState<SortKey>("useful");

  const getSceneName = (key: string) =>
    scenes.find((s) => s.key === key)?.name || key;
  const getToolName = (slug: string) =>
    tools.find((t) => t.slug === slug)?.name || slug;

  const filteredUsages = useMemo(() => {
    let result = usages.filter((u) => {
      if (subject !== "全部" && u.subj !== subject) return false;
      if (role !== "all" && u.role !== role) return false;
      if (scene !== "all" && u.scene !== scene) return false;
      return true;
    });

    switch (sort) {
      case "collect":
        result = [...result].sort((a, b) => b.collect - a.collect);
        break;
      case "pick":
        result = [...result].sort(
          (a, b) => (b.pick ? 1 : 0) - (a.pick ? 1 : 0) || b.useful - a.useful
        );
        break;
      case "new":
        result = [...result].sort((a, b) => Number(b.id) - Number(a.id));
        break;
      default:
        result = [...result].sort((a, b) => b.useful - a.useful);
    }

    return result;
  }, [usages, subject, role, scene, sort]);

  return (
    <main className="wrap">
      {/* Banner */}
      <div className="rel-banner">
        <Icon name="Notebook" size={14} className="inline" /> <b>用法库</b> 是老师亲测的<b>分步使用 SOP</b>；若想按教学环节<b>浏览工具</b>，请去{" "}
        <Link href="/scenes">全部场景 <Icon name="ArrowRight" size={12} className="inline" /></Link>
      </div>

      <div className="sec-head" style={{ marginTop: "22px" }}>
        <div>
          <h2>用法库 · 分步使用 SOP</h2>
          <div className="sub">
            「全部场景」找工具，「用法库」学方法：每张卡片都是打开即用的步骤，用{" "}
            <Icon name="ThumbsUp" size={13} className="inline" /> 有用 /
            <Icon name="BookmarkSimple" size={13} className="inline" /> 收藏 沉淀优质内容
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="filterbar">
        <div className="filter-group">
          <span className="lbl">学科</span>
          <div className="filter-opts">
            {SUBJECTS.map((s) => (
              <span
                key={s}
                className={`fopt ${subject === s ? "active" : ""}`}
                onClick={() => setSubject(s)}
              >
                {s}
              </span>
            ))}
          </div>
        </div>

        <div className="filter-group">
          <span className="lbl">角色</span>
          <div className="filter-opts">
            {ROLES.map((r) => (
              <span
                key={r}
                className={`fopt ${role === r ? "active" : ""}`}
                onClick={() => setRole(r)}
              >
                {r === "all" ? "全部" : r}
              </span>
            ))}
          </div>
        </div>

        <div className="filter-group">
          <span className="lbl">排序</span>
          <select
            className="sortsel"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
          >
            <option value="useful">最有用</option>
            <option value="collect">最多收藏</option>
            <option value="pick">编辑精选优先</option>
            <option value="new">最新</option>
          </select>
        </div>

        <div className="filter-count">{filteredUsages.length} 条 SOP</div>
      </div>

      {/* Scene Chips */}
      <div className="scene-chips">
        <span className="lbl2">按场景：</span>
        <div className="filter-opts">
          {SCENE_FILTERS.map((s) => (
            <span
              key={s.key}
              className={`fopt ${scene === s.key ? "active" : ""}`}
              onClick={() => setScene(s.key)}
            >
              {s.label}
            </span>
          ))}
        </div>
      </div>

      {/* Usage Cards */}
      <div className="pb-grid">
        {filteredUsages.map((usage) => {
          const tool = tools.find((t) => t.slug === usage.tool);
          return (
              <div
                key={usage.id}
                className="pb-card"
                data-id={usage.id}
                data-scene={usage.scene}
                data-role={usage.role}
                data-subj={usage.subj}
              >
              <div className="pb-top">
                <span className="pb-cat">{getSceneName(usage.scene)}</span>
                {usage.pick && (
                  <span className="editor-pick">
                    <Icon name="Star" size={10} weight="fill" className="inline" /> 编辑精选
                  </span>
                )}
              </div>
              <h3>
                <Link
                  href={`/usages/${usage.id}`}
                  style={{ color: "inherit", textDecoration: "none" }}
                >
                  {usage.title}
                </Link>
              </h3>
              <p>{usage.summary}</p>
              <div className="pb-meta">
                <span className="pb-steps">
                  <Icon name="ListNumbers" size={12} className="inline" /> {usage.steps} 步 SOP
                </span>
                <span className="pb-tool">来自 {getToolName(usage.tool)}</span>
              </div>
              <div className="pb-tags">
                <span className={`rb rb-${roleClass(usage.role)}`}>{usage.role}</span>
                <span
                  className="rb"
                  style={{
                    background: "var(--surface-2)",
                    color: "var(--muted)",
                  }}
                >
                  {usage.subj}
                </span>
                {tool && (
                  <Link
                    className="rb"
                    style={{
                      background: "var(--primary-soft)",
                      color: "var(--primary)",
                      textDecoration: "none",
                    }}
                    href={`/tool/${usage.tool}`}
                  >
                    {tool.name} <Icon name="ArrowUpRight" size={10} className="inline" />
                  </Link>
                )}
              </div>
              <div className="sp-row">
                <UsageUsefulCollect
                  usageId={usage.id}
                  baseUseful={usage.useful}
                  baseCollect={usage.collect}
                />
              </div>
            </div>
          );
        })}
      </div>

      {filteredUsages.length === 0 && (
        <div className="empty">
          <div className="big">
            <Icon name="MagnifyingGlass" size={40} />
          </div>
          <div>没有找到匹配的用法，试试调整筛选条件</div>
        </div>
      )}
    </main>
  );
}

export default function UsagesPage() {
  return (
    <Suspense
      fallback={
        <div className="wrap">
          <div className="empty">加载中…</div>
        </div>
      }
    >
      <UsagesInner />
    </Suspense>
  );
}
