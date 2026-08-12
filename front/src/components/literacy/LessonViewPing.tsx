"use client";

import { useEffect, useRef } from "react";
import { trackNow } from "@/lib/track";

// 浏览埋点：lesson 挂载即发 lit_lesson_view，停留满 30s 再发 lit_lesson_view_30s
// （北极星指标之一）。module 仅发 lit_module_view。后端对已存在的 (anonId,name,refId)
// 30 分钟去重，刷新不会重复计数。
export default function LessonViewPing({
  kind,
  slug,
}: {
  kind: "lesson" | "module";
  slug: string;
}) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;

    if (kind === "lesson") {
      trackNow({ name: "lit_lesson_view", refType: "lesson", refId: slug });
      const t = setTimeout(() => {
        trackNow({ name: "lit_lesson_view_30s", refType: "lesson", refId: slug });
      }, 30 * 1000);
      return () => clearTimeout(t);
    }
    trackNow({ name: "lit_module_view", refType: "module", refId: slug });
    return;
  }, [kind, slug]);

  return null;
}
