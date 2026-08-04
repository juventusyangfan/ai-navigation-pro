"use client";

import { useState } from "react";
import { Path } from "@/lib/content";
import SopPathView from "./SopPathView";

export default function SopTabs({
  paths,
  toolSlug,
}: {
  paths: Path[];
  toolSlug?: string;
}) {
  const [active, setActive] = useState(0);
  const path = paths[active];

  const meta =
    (path.estMinutes ? `约 ${path.estMinutes} 分钟` : "") +
    (path.level ? ` · ${path.level}` : "") +
    (path.forRole ? ` · ${path.forRole}` : "");

  return (
    <div>
      <div className="sop-tabs">
        {paths.map((p, i) => (
          <button
            key={i}
            className={`sop-tab ${i === active ? "active" : ""}`}
            onClick={() => setActive(i)}
          >
            <span className="sop-tab-title">{p.title}</span>
            {p.summary && <span className="sop-tab-sum">{p.summary}</span>}
            {(p.estMinutes || p.level || p.forRole) && (
              <span className="sop-tab-meta">{meta}</span>
            )}
          </button>
        ))}
      </div>

      <SopPathView path={path} toolSlug={toolSlug} />
    </div>
  );
}
