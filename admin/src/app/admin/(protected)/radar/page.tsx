"use client";

import { useState } from "react";
import ImportPanel from "./ImportPanel";
import ItemsPanel from "./ItemsPanel";
import HistoryPanel from "./HistoryPanel";

const TABS = [
  { key: "import", label: "导入新一期" },
  { key: "items", label: "条目维护" },
  { key: "history", label: "上传历史" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

/**
 * 赛事雷达后台。
 *
 * 分工必须守住：**内容生产归技能（radar.py），内容审核归这里**。
 * 本页面不做检索、不重新打分，只负责「导入 → 门槛校验 → 人工过审 → 发布 → 下架」。
 * 若这里退化成人工从头录入，自动化的价值归零，而且合规风险升到最高。
 */
export default function RadarPage() {
  const [tab, setTab] = useState<TabKey>("import");
  const [bump, setBump] = useState(0);
  const touch = () => setBump((n) => n + 1);

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto" }}>
      <div className="page-head">
        <div>
          <h1>赛事雷达</h1>
          <div className="desc">
            导入技能产出的候选池 → 服务端门槛校验 → 人工过审 → 发布到 h5.eanavi.com/radar/
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`btn${tab === t.key ? " primary" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "import" && <ImportPanel onDone={touch} />}
      {tab === "items" && <ItemsPanel refreshKey={bump} onDone={touch} />}
      {tab === "history" && <HistoryPanel refreshKey={bump} onDone={touch} />}
    </div>
  );
}
