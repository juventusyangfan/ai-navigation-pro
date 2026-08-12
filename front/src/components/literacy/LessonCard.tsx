import Link from "next/link";
import { Icon } from "@/lib/icons";
import type { LitLessonCard } from "@/lib/content";

export default function LessonCard({ lesson }: { lesson: LitLessonCard }) {
  return (
    <Link
      href={`/literacy/${lesson.moduleSlug}/${lesson.slug}`}
      className="lit-lesson-row"
    >
      <span className="n">{lesson.order + 1}</span>
      <span className="tt">{lesson.title}</span>
      <span className="lit-tag-src">
        {lesson.source === "official" ? "官方课" : "本站"}
      </span>
      <span className="m">
        {lesson.durationMin ? `${lesson.durationMin}分` : ""}
        {lesson.sopCount ? ` · ${lesson.sopCount}条SOP` : ""}
      </span>
      <Icon name="ArrowRight" size={14} className="inline muted" />
    </Link>
  );
}
