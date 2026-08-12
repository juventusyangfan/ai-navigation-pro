import Link from "next/link";
import { Icon } from "@/lib/icons";
import type { LitLessonCard } from "@/lib/content";

// 课时导航：sidebar = 副栏竖列（当前项 aria-current）；footer = 上一节/下一节 + 返回模块。
// 翻页锁在模块内，不跨模块；首/末节禁用项渲染为 <span>（不渲染成可点灰按钮）。
export default function LessonNav({
  layout,
  lessons,
  currentSlug,
  moduleSlug,
  moduleTitle,
}: {
  layout: "sidebar" | "footer";
  lessons: LitLessonCard[];
  currentSlug: string;
  moduleSlug: string;
  moduleTitle: string;
}) {
  if (layout === "sidebar") {
    return (
      <div className="card aside-card">
        <h3>
          <span className="dot" />
          本模块 · {moduleTitle}
        </h3>
        <div className="lit-lessons">
          {lessons.map((l, i) => {
            const active = l.slug === currentSlug;
            return (
              <Link
                key={l.slug}
                href={`/literacy/${moduleSlug}/${l.slug}`}
                className={`lit-lesson-row${active ? " is-current" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                <span className="n">{i + 1}</span>
                <span className="tt">{l.title}</span>
                <span className="lit-tag-src">
                  {l.source === "official" ? "官方课" : "本站"}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    );
  }

  const idx = lessons.findIndex((l) => l.slug === currentSlug);
  const prev = idx > 0 ? lessons[idx - 1] : undefined;
  const next = idx >= 0 && idx < lessons.length - 1 ? lessons[idx + 1] : undefined;

  return (
    <div className="lit-nav">
      {prev ? (
        <Link
          href={`/literacy/${moduleSlug}/${prev.slug}`}
          className="lit-nav-item"
        >
          <Icon name="CaretLeft" size={14} className="inline" /> {prev.title}
        </Link>
      ) : (
        <span className="lit-nav-item is-disabled">
          <Icon name="CaretLeft" size={14} className="inline" /> 上一节
        </span>
      )}
      <Link href={`/literacy/${moduleSlug}`} className="lit-nav-item">
        返回 {moduleTitle}
      </Link>
      {next ? (
        <Link
          href={`/literacy/${moduleSlug}/${next.slug}`}
          className="lit-nav-item"
        >
          {next.title} <Icon name="CaretRight" size={14} className="inline" />
        </Link>
      ) : (
        <span className="lit-nav-item is-disabled">
          下一节 <Icon name="CaretRight" size={14} className="inline" />
        </span>
      )}
    </div>
  );
}
