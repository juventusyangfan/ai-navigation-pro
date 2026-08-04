"use client";

import { useState, useEffect } from "react";
import { content, type Tool, type Pricing, type Role } from "@/lib/content";
import ToolCard from "./ToolCard";
import { Icon } from "@/lib/icons";

export default function SceneTools({ sceneKey }: { sceneKey: string }) {
  const [tools, setTools] = useState<Tool[]>([]);
  useEffect(() => {
    content.getTools().then(setTools);
  }, []);

  const all = tools.filter((t) => t.scenes.includes(sceneKey));
  const [role, setRole] = useState<Role | "all">("all");
  const [price, setPrice] = useState<Pricing | "all">("all");
  const [plat, setPlat] = useState<string>("all");

  const filtered = all.filter(
    (t) =>
      (role === "all" || t.roles.includes(role)) &&
      (price === "all" || t.pricing === price) &&
      (plat === "all" || t.platform.includes(plat)),
  );

  return (
    <>
      <div className="filterbar">
        <div className="filter-group">
          <span className="lbl">角色</span>
          <div className="filter-opts">
            <span
              className={`fopt ${role === "all" ? "active" : ""}`}
              onClick={() => setRole("all")}
            >
              全部
            </span>
            {(["老师", "学生", "家长"] as Role[]).map((r) => (
              <span
                key={r}
                className={`fopt ${role === r ? "active" : ""}`}
                onClick={() => setRole(r)}
              >
                {r}
              </span>
            ))}
          </div>
        </div>
        <div className="filter-group">
          <span className="lbl">定价</span>
          <div className="filter-opts">
            <span
              className={`fopt ${price === "all" ? "active" : ""}`}
              onClick={() => setPrice("all")}
            >
              全部
            </span>
            {(["Free", "Freemium", "Paid"] as Pricing[]).map((p) => (
              <span
                key={p}
                className={`fopt ${price === p ? "active" : ""}`}
                onClick={() => setPrice(p)}
              >
                {p === "Free" ? "免费" : p === "Freemium" ? "免费+增值" : "付费"}
              </span>
            ))}
          </div>
        </div>
        <div className="filter-group">
          <span className="lbl">平台</span>
          <div className="filter-opts">
            <span
              className={`fopt ${plat === "all" ? "active" : ""}`}
              onClick={() => setPlat("all")}
            >
              全部
            </span>
            {["网页", "APP"].map((p) => (
              <span
                key={p}
                className={`fopt ${plat === p ? "active" : ""}`}
                onClick={() => setPlat(p)}
              >
                {p}
              </span>
            ))}
          </div>
        </div>
        <div className="filter-count">{filtered.length} 个工具</div>
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
