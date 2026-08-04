"use client";

import { useState, useEffect, useMemo, type ReactNode } from "react";
import { content, type Tool, type Scene, type Role, type Pricing } from "@/lib/content";
import ToolCard from "./ToolCard";
import { Icon } from "@/lib/icons";

const ROLES: Role[] = ["老师", "学生", "家长"];
const PRICES: Pricing[] = ["Free", "Freemium", "Paid"];
const RATINGS = [
  { v: 0, label: "全部" },
  { v: 4.5, label: "4.5 分以上" },
  { v: 4.3, label: "4.3 分以上" },
];

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="filter-group">
      <span className="lbl">{label}</span>
      <div className="filter-opts">{children}</div>
    </div>
  );
}

export default function ToolsBrowser() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  useEffect(() => {
    content.getTools().then(setTools);
    content.getScenes().then(setScenes);
  }, []);

  const subjects = useMemo(
    () => Array.from(new Set(tools.flatMap((t) => t.subjects))),
    [tools],
  );

  const [role, setRole] = useState<Role | "all">("all");
  const [scene, setScene] = useState<string>("all");
  const [subject, setSubject] = useState<string>("all");
  const [price, setPrice] = useState<Pricing | "all">("all");
  const [minRating, setMinRating] = useState<number>(0);
  const [sort, setSort] = useState<"rating" | "name" | "latest">("rating");

  const filtered = useMemo(() => {
    let list = tools.filter(
      (t) =>
        (role === "all" || t.roles.includes(role)) &&
        (scene === "all" || t.scenes.includes(scene)) &&
        (subject === "all" || t.subjects.includes(subject)) &&
        (price === "all" || t.pricing === price) &&
        t.rating >= minRating,
    );
    if (sort === "rating") list = [...list].sort((a, b) => b.rating - a.rating);
    else if (sort === "name") list = [...list].sort((a, b) => a.name.localeCompare(b.name, "zh"));
    else if (sort === "latest") list = [...list].reverse();
    return list;
  }, [tools, role, scene, subject, price, minRating, sort]);

  return (
    <>
      <div className="filterbar">
        <Group label="角色">
          <span className={`fopt ${role === "all" ? "active" : ""}`} onClick={() => setRole("all")}>
            全部
          </span>
          {ROLES.map((r) => (
            <span key={r} className={`fopt ${role === r ? "active" : ""}`} onClick={() => setRole(r)}>
              {r}
            </span>
          ))}
        </Group>
        <Group label="场景">
          <span className={`fopt ${scene === "all" ? "active" : ""}`} onClick={() => setScene("all")}>
            全部
          </span>
          {scenes.map((s) => (
            <span
              key={s.key}
              className={`fopt ${scene === s.key ? "active" : ""}`}
              onClick={() => setScene(s.key)}
            >
              {s.name}
            </span>
          ))}
        </Group>
        <Group label="学科">
          <span className={`fopt ${subject === "all" ? "active" : ""}`} onClick={() => setSubject("all")}>
            全部
          </span>
          {subjects.map((s) => (
            <span
              key={s}
              className={`fopt ${subject === s ? "active" : ""}`}
              onClick={() => setSubject(s)}
            >
              {s}
            </span>
          ))}
        </Group>
        <Group label="定价">
          <span className={`fopt ${price === "all" ? "active" : ""}`} onClick={() => setPrice("all")}>
            全部
          </span>
          {PRICES.map((p) => (
            <span
              key={p}
              className={`fopt ${price === p ? "active" : ""}`}
              onClick={() => setPrice(p)}
            >
              {p === "Free" ? "免费" : p === "Freemium" ? "免费+增值" : "付费"}
            </span>
          ))}
        </Group>
        <Group label="评分">
          {RATINGS.map((r) => (
            <span
              key={r.v}
              className={`fopt ${minRating === r.v ? "active" : ""}`}
              onClick={() => setMinRating(r.v)}
            >
              {r.label}
            </span>
          ))}
        </Group>
        <div className="filter-count" style={{ marginLeft: 0 }}>
          {filtered.length} 个工具
        </div>
        <select
          className="sortsel"
          style={{ marginLeft: "auto" }}
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
        >
          <option value="rating">评分高 → 低</option>
          <option value="name">名称 A → Z</option>
          <option value="latest">最新收录</option>
        </select>
      </div>

      <div className="tool-grid">
        {filtered.map((t) => (
          <ToolCard key={t.slug} tool={t} />
        ))}
        {filtered.length === 0 && (
          <div className="empty">
            <div className="big">
              <Icon name="FolderOpen" size={40} />
            </div>
            该条件下暂无工具，欢迎投稿。
          </div>
        )}
      </div>
    </>
  );
}
