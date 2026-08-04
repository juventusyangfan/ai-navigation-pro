"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Tool, roleClass, pricingLabel, content } from "@/lib/content";
import FavButton from "./FavButton";
import StarRating from "./StarRating";
import { Icon } from "@/lib/icons";

export default function ToolCard({ tool }: { tool: Tool }) {
  const [sceneName, setSceneName] = useState<Record<string, string>>({});
  useEffect(() => {
    content.getSceneName().then(setSceneName);
  }, []);

  const hasSop = tool.paths.length > 0;
  return (
    <div
      className="tool-card"
      data-roles={tool.roles.join(",")}
      data-price={tool.pricing}
      data-plat={tool.platform}
    >
      <FavButton slug={tool.slug} name={tool.name} />
      <Link href={`/tool/${tool.slug}`} className="tool-top">
        <div className="tool-logo" style={{ background: tool.color }}>
          {tool.logo}
        </div>
        <div>
          <div className="tool-name">{tool.name}</div>
          <div className="tool-tagline">{tool.tagline}</div>
        </div>
      </Link>
      <div>
        {tool.roles.map((r) => (
          <span key={r} className={`rb rb-${roleClass(r)}`}>
            {r}
          </span>
        ))}
      </div>
      <StarRating value={tool.rating} size={13} showNumber />
      <div className="tool-meta">
        {tool.scenes.map((s) => (
          <Link key={s} href={`/scenes/${s}`} className="tag scene">
            {sceneName[s] || s}
          </Link>
        ))}
        <span className={`price ${tool.pricing}`}>{pricingLabel(tool.pricing)}</span>
      </div>
      {hasSop && (
        <div style={{ marginTop: 4 }}>
          <span className="tool-sop-badge">
            <Icon name="Notebook" size={13} className="inline" /> 含 {tool.paths.length} 条使用路径
          </span>
        </div>
      )}
    </div>
  );
}
