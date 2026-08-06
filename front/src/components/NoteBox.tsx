"use client";

import { useState, useEffect } from "react";
import { Icon } from "@/lib/icons";
import { toast } from "@/lib/toast";
import { fetchNote, saveNote } from "@/lib/interactions";

// 一条 SOP 笔记对接后台 /api/me/notes（按 用户 + refType + refId 唯一存储）。
// refType: "path" -> refId 传用法 usageId（或 sopPath id）；"tool" -> 传工具 slug。
export default function NoteBox({
  refType = "path",
  refId,
  title,
  href,
}: {
  refType?: string;
  refId: string;
  title: string;
  href: string;
}) {
  const [content, setContent] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const c = await fetchNote(refType, refId);
      if (alive) setContent(c);
    })();
    return () => {
      alive = false;
    };
  }, [refType, refId]);

  const save = async () => {
    setBusy(true);
    try {
      const res = await saveNote(refType, refId, content);
      if (res.needLogin) {
        toast("请先登录后再保存笔记");
        return;
      }
      if (res.error) {
        toast(res.error);
        return;
      }
      setSaved(true);
      toast("笔记已保存");
      setTimeout(() => setSaved(false), 1500);
    } finally {
      setBusy(false);
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
        <button className="btn btn-sm btn-primary" onClick={save} disabled={busy}>
          {busy ? "保存中…" : saved ? "已保存" : "保存笔记"}
        </button>
        <span className="fb-count">已同步云端，可在「个人中心 → SOP 笔记」查看</span>
      </div>
    </div>
  );
}
