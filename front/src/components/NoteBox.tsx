"use client";

import { useState, useEffect } from "react";
import { Icon } from "@/lib/icons";
import { toast } from "@/lib/toast";

// 一条 SOP 笔记在 localStorage 的存储结构。
// 后台上线后，notes 表以 refId 为主键聚合，此结构可直接映射（见方案 2.4）。
export type NoteRecord = {
  title: string;
  content: string;
  href: string;
  ts: number;
};

const KEY = "ea_notes"; // Record<refId, NoteRecord>

export default function NoteBox({
  refId,
  title,
  href,
}: {
  refId: string;
  title: string;
  href: string;
}) {
  const [content, setContent] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const all = JSON.parse(localStorage.getItem(KEY) || "{}") as Record<string, NoteRecord>;
      const rec = all[refId];
      if (rec && typeof rec.content === "string") setContent(rec.content);
    } catch {
      /* 忽略损坏数据 */
    }
  }, [refId]);

  const save = () => {
    try {
      const all = JSON.parse(localStorage.getItem(KEY) || "{}") as Record<string, NoteRecord>;
      all[refId] = { title, content, href, ts: Date.now() };
      localStorage.setItem(KEY, JSON.stringify(all));
      setSaved(true);
      toast("笔记已保存");
      setTimeout(() => setSaved(false), 1500);
    } catch {
      toast("保存失败，请重试");
    }
  };

  return (
    <div className="note-box" style={{ marginTop: 16 }}>
      <div className="note-head">
        <Icon name="NotePencil" size={16} className="inline" /> 我的笔记 · {title}
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="记一下这一步的关键心得、要替换的 {{变量}}、避坑点…"
      />
      <div className="fb-row">
        <button className="btn btn-sm btn-primary" onClick={save}>
          {saved ? "已保存" : "保存笔记"}
        </button>
        <span className="fb-count">仅本地保存（原型）· 后台上线后自动同步</span>
      </div>
    </div>
  );
}
