"use client";

import { useState } from "react";
import { toast } from "@/lib/toast";
import { Icon } from "@/lib/icons";
import { submitFeedback } from "@/lib/interactions";

export default function FeedbackBox({
  toolSlug,
  toolName,
}: {
  toolSlug: string;
  toolName: string;
}) {
  const [text, setText] = useState("");
  const [kind, setKind] = useState<"纠错" | "建议">("纠错");
  const [busy, setBusy] = useState(false);

  async function submit() {
    const value = text.trim();
    if (!value) {
      toast("请先填写内容");
      return;
    }
    setBusy(true);
    try {
      const res = await submitFeedback(toolSlug, kind, value);
      if (res.needLogin) {
        toast("请先登录后再提交反馈");
        return;
      }
      if (res.error) {
        toast(res.error);
        return;
      }
      setText("");
      toast("已提交反馈，可在「个人中心 → 我的反馈」查看");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="note-box">
      <div className="note-head">
        <Icon name="Lightbulb" size={16} className="inline" /> 纠错 / 补充建议（{toolName}）
      </div>
      <div className="filter-opts" style={{ marginBottom: 8 }}>
        <span
          className={`fopt ${kind === "纠错" ? "active" : ""}`}
          onClick={() => setKind("纠错")}
        >
          纠错
        </span>
        <span
          className={`fopt ${kind === "建议" ? "active" : ""}`}
          onClick={() => setKind("建议")}
        >
          建议
        </span>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="请描述你的建议或发现的问题…"
      />
      <div className="fb-row">
        <button
          className="btn btn-sm btn-primary"
          onClick={submit}
          disabled={busy}
        >
          {busy ? "提交中…" : "提交反馈"}
        </button>
        <span className="fb-count">提交后可在「个人中心 → 我的反馈」查看</span>
      </div>
    </div>
  );
}
