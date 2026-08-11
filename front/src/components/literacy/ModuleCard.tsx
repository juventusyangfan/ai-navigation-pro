import Link from "next/link";
import { Icon } from "@/lib/icons";
import type { LitModuleCard, LitLessonCard } from "@/lib/content";

interface ToolRef {
  slug: string;
  name: string;
}

export default function ModuleCard({
  module,
  lessons,
  tools,
}: {
  module: LitModuleCard;
  lessons: LitLessonCard[];
  tools: ToolRef[];
}) {
  return (
    <div className="lit-mod">
      <div className="lit-mod-head">
        <span className="lit-num">{module.num}</span>
        <div>
          <h3>{module.title}</h3>
          <p className="muted">{module.summary}</p>
        </div>
      </div>

      {lessons.length > 0 && (
        <div className="lit-row" style={{ marginTop: 10 }}>
          <span className="lit-k">课时</span>
          {lessons.slice(0, 4).map((l) => (
            <Link
              key={l.slug}
              href={`/literacy/${l.moduleSlug}/${l.slug}`}
              className="sop-link"
            >
              ▸ {l.title}
            </Link>
          ))}
          {lessons.length > 4 && (
            <Link href={`/literacy/${module.slug}`} className="chip-link">
              还有 {lessons.length - 4} 节 →
            </Link>
          )}
        </div>
      )}

      {tools.length > 0 && (
        <div className="lit-row">
          <span className="lit-k">相关工具</span>
          {tools.map((t) => (
            <Link key={t.slug} href={`/tool/${t.slug}`} className="chip-link">
              {t.name} <Icon name="ArrowUpRight" size={10} className="inline" />
            </Link>
          ))}
        </div>
      )}

      <div className="lit-row" style={{ borderBottom: "none", paddingBottom: 0 }}>
        <Link href={`/literacy/${module.slug}`} className="link-more">
          进入模块 <Icon name="ArrowRight" size={12} className="inline" />
        </Link>
      </div>
    </div>
  );
}
