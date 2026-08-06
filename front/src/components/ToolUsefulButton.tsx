"use client";

import { useState } from "react";
import { useUseful } from "@/lib/interactions";
import { Icon } from "@/lib/icons";
import { toast } from "@/lib/toast";

// 工具详情页「有用」按钮（工具级，refType=tool），对接 /api/me/useful。
export default function ToolUsefulButton({
  slug,
  baseUseful,
}: {
  slug: string;
  baseUseful: number;
}) {
  const { on, toggle } = useUseful(slug, "tool");
  const [count, setCount] = useState(baseUseful);

  return (
    <button
      type="button"
      className={`sp-btn ${on ? "on" : ""}`}
      onClick={async () => {
        try {
          const r = await toggle();
          if (r && "needLogin" in r) {
            toast("请先登录后再标记");
            return;
          }
          setCount(r.count);
          toast(r.on ? "已标记「有用」" : "已取消「有用」");
        } catch (e) {
          toast(e instanceof Error ? e.message : "操作失败");
        }
      }}
    >
      <Icon name="ThumbsUp" size={14} className="inline" /> 有用 <b>{count}</b>
    </button>
  );
}
