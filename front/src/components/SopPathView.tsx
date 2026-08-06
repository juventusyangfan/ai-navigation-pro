"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Path, content, type Usage } from "@/lib/content";
import CopyButton from "./CopyButton";
import NoteBox from "./NoteBox";
import UsageUsefulCollect from "./UsageUsefulCollect";
import { Icon } from "@/lib/icons";
import { toast } from "@/lib/toast";

// 将提示词中的 {{变量}} 占位符高亮，便于用户识别“需要替换的内容”。
// 仅用内联样式，不改动任何样式表。
function renderPrompt(text: string) {
  const parts = text.split(/(\{\{[^}]+\}\})/g);
  return parts.map((part, i) => {
    if (/^\{\{[^}]+\}\}$/.test(part)) {
      return (
        <span
          key={i}
          style={{
            color: "var(--color-primary, #0cf)",
            background: "rgba(12,204,255,.12)",
            padding: "0 4px",
            borderRadius: 4,
            fontWeight: 600,
          }}
        >
          {part}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function Media({ m }: { m: NonNullable<Path["steps"][number]["media"]> }) {
  if (m.type === "image")
    return (
      <div className="step-media">
        <div className="ph">
          <Icon name="Image" size={18} className="inline" /> {m.label}
        </div>
        <div className="cap">配图示意 · 点击可放大（原型占位）</div>
      </div>
    );
  if (m.type === "video")
    return (
      <div className="step-media vid">
        <div className="ph">
          <Icon name="VideoCamera" size={18} className="inline" /> {m.label}
        </div>
        <div className="play">
          <Icon name="Play" size={20} weight="fill" />
        </div>
        <div className="cap">视频演示（原型占位）</div>
      </div>
    );
  return (
    <div className="att">
      <span className="ic">
        <Icon name="Paperclip" size={16} />
      </span>
      <div>
        <b>{m.label}</b>
        <small>课件模板 · 点击下载</small>
      </div>
      <span className="dl">下载</span>
    </div>
  );
}

function buildSopText(path: Path): string {
  const lines: string[] = [`【${path.title}】`];
  if (path.summary) lines.push(path.summary);
  lines.push("");
  path.steps.forEach((s, i) => {
    lines.push(`步骤 ${i + 1}：${s.action}`);
    if (s.prompt) {
      lines.push("提示词：", s.prompt, "");
    }
    if (s.outputSample) {
      lines.push("产出示例：", s.outputSample, "");
    }
  });
  lines.push("—— 来自 教AI导航");
  return lines.join("\n");
}

// 单条使用路径的完整渲染：社会证明头部 + 完成进度 + 步骤时间线。
// 抽出自 SopTabs，供「工具详情页」与「用法详情页」共同复用，避免重复。
// usage/toolName 由用法详情页直接透传；工具详情页未提供时，按 path.usageId 客户端取数兜底。
export default function SopPathView({
  path,
  toolSlug,
  usage: usageProp,
  toolName: toolNameProp,
}: {
  path: Path;
  toolSlug?: string;
  usage?: Usage;
  toolName?: string;
}) {
  const [resolved, setResolved] = useState<{ usage?: Usage; toolName: string }>({
    usage: usageProp,
    toolName: toolNameProp ?? usageProp?.toolName ?? "",
  });

  // 工具详情页只传 path + toolSlug，未给 usage：按 usageId 客户端取数（兼容 static / remote）。
  useEffect(() => {
    if (usageProp || !path.usageId) return;
    const usageId = path.usageId;
    let cancelled = false;
    (async () => {
      const u = await content.getUsage(usageId);
      if (!u || cancelled) return;
      const toolName =
        u.toolName ?? (await content.getToolMap())[u.tool]?.name ?? u.tool;
      if (!cancelled) setResolved({ usage: u, toolName });
    })();
    return () => {
      cancelled = true;
    };
  }, [usageProp, path.usageId]);

  const storageKey = toolSlug
    ? `ea:sop:${toolSlug}:${path.usageId ?? path.title}`
    : `ea:sop:${path.usageId ?? path.title}`;

  const [checked, setChecked] = useState<boolean[]>([]);

  // 进入时从 localStorage 恢复该路径的完成状态
  useEffect(() => {
    let init: boolean[] = [];
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) init = JSON.parse(raw) as boolean[];
    } catch {
      init = [];
    }
    setChecked(path.steps.map((_, i) => Boolean(init[i])));
  }, [storageKey, path.steps.length]);

  const toggle = (i: number) => {
    setChecked((prev) => {
      const next = prev.map((v, idx) => (idx === i ? !v : v));
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* 忽略写入失败 */
      }
      return next;
    });
  };

  const doneCount = checked.filter(Boolean).length;
  const total = path.steps.length;
  const pct = total ? Math.round((doneCount / total) * 100) : 0;

  const usage = resolved.usage;

  // 笔记写入入口（C2）：以 usageId 或 工具+标题 作为稳定 refId，云端按 (用户, path, refId) 唯一存储
  const refId = path.usageId ?? `${toolSlug ?? "sop"}:${path.title}`;
  const noteHref = path.usageId ? `/usages/${path.usageId}` : `/tool/${toolSlug ?? ""}`;

  const copyAll = () => {
    const text = buildSopText(path);
    navigator.clipboard?.writeText(text);
    toast("已复制完整 SOP");
  };

  return (
    <div>
      {usage && (
        <div className="sop-social">
          {usage.pick && <span className="sop-pick">编辑精选</span>}
          <UsageUsefulCollect
            usageId={usage.id}
            baseUseful={usage.useful}
            baseCollect={usage.collect}
          />
          <Link href={`/usages?scene=${usage.scene}`} className="sop-social-link">
            查看用法 <Icon name="ArrowRight" size={12} className="inline" />
          </Link>
        </div>
      )}

      <div className="sop-bar">
        <div className="sop-progress">
          <div className="sop-progress-meta">已完成 {doneCount}/{total} 步</div>
          <div className="sop-progress-track">
            <div className="sop-progress-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <button className="sop-copyall" onClick={copyAll}>
          <Icon name="Copy" size={14} className="inline" /> 复制完整 SOP
        </button>
      </div>

      <div className="sop-timeline">
        {path.steps.map((s, i) => {
          const done = checked[i];
          return (
            <div className={`step ${done ? "done" : ""}`} key={i}>
              <div className="step-num">{i + 1}</div>
              <div className="step-body">
                <div className="step-head">
                  <div className="step-action">{s.action}</div>
                  <button
                    className={`sop-check ${done ? "on" : ""}`}
                    aria-pressed={done}
                    title={done ? "标记为未完成" : "标记为已完成"}
                    onClick={() => toggle(i)}
                  >
                    {done && <Icon name="Check" size={14} weight="bold" />}
                  </button>
                </div>
                {s.goal && <div className="step-goal">目标：{s.goal}</div>}
                {s.prompt && (
                  <div className="prompt-box">
                    {renderPrompt(s.prompt)}
                    <CopyButton text={s.prompt} />
                  </div>
                )}
                <div className="step-output" style={{ whiteSpace: "pre-wrap" }}>
                  <Icon name="ArrowRight" size={12} className="inline" />{" "}
                  <b>产出示例：</b>
                  {s.outputSample}
                </div>
                {s.tip && (
                  <div className="tip">
                    <span className="ic">
                      <Icon name="Lightbulb" size={14} />
                    </span>
                    <span>{s.tip}</span>
                  </div>
                )}
                {s.pitfall && (
                  <div className="pitfall">
                    <span className="ic">
                      <Icon name="Warning" size={14} />
                    </span>
                    <span>{s.pitfall}</span>
                  </div>
                )}
                {s.branch && s.branch.length > 0 && (
                  <div className="branch">
                    <div className="branch-head">
                      <Icon name="GitBranch" size={14} className="inline" /> 决策分支
                    </div>
                    {s.branch.map((b, bi) => (
                      <div className="branch-item" key={bi}>
                        <span className="branch-when">若 {b.when}</span>
                        <span className="branch-then">{b.then}</span>
                      </div>
                    ))}
                  </div>
                )}
                {s.media && <Media m={s.media} />}
              </div>
            </div>
          );
        })}
      </div>

      <NoteBox refType="path" refId={refId} title={path.title} href={noteHref} />
    </div>
  );
}
