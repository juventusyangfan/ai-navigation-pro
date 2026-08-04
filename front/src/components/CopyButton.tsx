"use client";

import { toast } from "@/lib/toast";

export default function CopyButton({ text }: { text: string }) {
  return (
    <button
      className="copy-btn"
      onClick={() => {
        navigator.clipboard?.writeText(text);
        toast("提示词已复制");
      }}
    >
      复制
    </button>
  );
}
