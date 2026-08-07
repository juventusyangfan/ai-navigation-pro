"use client";

import { useState, useCallback } from "react";
import { Icon } from "@/lib/icons";

/**
 * 写入剪贴板（兼容非安全上下文，如 http://IP 访问）。
 * 优先使用现代 navigator.clipboard API，不可用时回退到 execCommand('copy')。
 */
export function copyText(text: string): boolean {
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // clipboard API 可能抛出（如权限拒绝），回退到 fallback
  }

  // Fallback：经典 textarea + execCommand 方案，兼容 http 非安全上下文
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  ta.style.top = "-9999px";
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  document.body.removeChild(ta);
  return ok;
}

interface CopyButtonProps {
  text: string;
  /** 复制后的提示文案，默认 "已复制" */
  label?: string;
  /** 未复制时显示的文案，默认 "复制" */
  idleLabel?: string;
  /** 复制成功后保持 "已复制" 状态的毫秒数，默认 2000 */
  cooldown?: number;
}

export default function CopyButton({
  text,
  label = "已复制",
  idleLabel = "复制",
  cooldown = 2000,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    if (copied) return;
    copyText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), cooldown);
  }, [text, copied, cooldown]);

  return (
    <button
      className={`copy-btn${copied ? " copied" : ""}`}
      onClick={handleCopy}
      aria-live="polite"
    >
      {copied ? (
        <>
          <Icon name="Check" size={12} weight="bold" className="inline" /> {label}
        </>
      ) : (
        idleLabel
      )}
    </button>
  );
}
