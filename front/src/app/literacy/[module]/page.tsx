import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { content, type LitModuleCard } from "@/lib/content";
import { Icon } from "@/lib/icons";
import LessonCard from "@/components/literacy/LessonCard";
import LessonViewPing from "@/components/literacy/LessonViewPing";

// 模块页：学习清单 + 完成感。承载「这一块全貌」，非必经中转站。
// ISR 600 + SSG（generateStaticParams 失败兜底返回 []）。
export const revalidate = 600;

export async function generateStaticParams() {
  try {
    const modules = await content.getLitModules();
    return modules.map((m) => ({ module: m.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ module: string }>;
}): Promise<Metadata> {
  const { module } = await params;
  const m = await content.getLitModule(module);
  if (!m) return { title: "模块未找到 · 智用笔记" };
  return {
    title: `${m.title} · AI通识课 · 智用笔记`,
    description: m.desc || m.summary,
    alternates: { canonical: `/literacy/${m.slug}` },
  };
}

export default async function ModulePage({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const { module } = await params;
  const [m, allModules, toolMap] = await Promise.all([
    content.getLitModule(module),
    content.getLitModules(),
    content.getToolMap(),
  ]);
  if (!m) notFound();

  const lessons = m.lessons;
  const officialInModule = lessons.filter((l) => l.source === "official").length;
  const sopInModule = lessons.reduce((s, l) => s + l.sopCount, 0);
  const totalMin = lessons.reduce((s, l) => s + (l.durationMin ?? 0), 0);
  const first = lessons.slice().sort((a, b) => a.order - b.order)[0];
  const otherModules = (allModules as LitModuleCard[]).filter((x) => x.slug !== m.slug);

  const idx = allModules.findIndex((x) => x.slug === m.slug);
  const prevMod = idx > 0 ? allModules[idx - 1] : undefined;
  const nextMod =
    idx >= 0 && idx < allModules.length - 1 ? allModules[idx + 1] : undefined;

  return (
    <main className="wrap py-8">
      <LessonViewPing kind="module" slug={m.slug} />

      <nav className="crumb">
        <Link href="/literacy">AI通识课</Link>
        <span>/</span>
        <b>{m.title}</b>
      </nav>

      <div className="detail-head">
        <span className="lit-num-lg">{m.num}</span>
        <div>
          <h1>{m.title}</h1>
          <p className="detail-tagline">{m.desc || m.summary}</p>
          <div className="detail-tags">
            <span className="tag">{lessons.length} 节课</span>
            <span className="tag">{officialInModule} 节官方</span>
            <span className="tag">{sopInModule} 条 SOP</span>
            {totalMin > 0 && <span className="tag">约 {totalMin} 分钟</span>}
          </div>
          <div className="detail-actions">
            {first && (
              <Link
                href={`/literacy/${m.slug}/${first.slug}`}
                className="btn btn-primary"
              >
                从第 1 节开始
                <Icon name="ArrowRight" size={14} className="inline" aria-hidden="true" />
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card-stack">
          <section className="card">
            <h3>
              <span className="dot" />
              学完这个模块，你能——
            </h3>
            {m.goal && <p style={{ marginBottom: 12 }}>{m.goal}</p>}
            <div className="detail-tags">
              {m.keywords.map((k) => (
                <span key={k} className="tag">
                  {k}
                </span>
              ))}
            </div>
          </section>

          <section className="card">
            <h3>
              <span className="dot" />
              {lessons.length} 节课
            </h3>
            <div className="lit-lessons">
              {lessons.map((l) => (
                <LessonCard key={l.slug} lesson={l} />
              ))}
            </div>
          </section>

          {m.toolSlugs.length > 0 && (
            <section className="card">
              <h3>
                <span className="dot" />
                本模块用到的工具
              </h3>
              {m.toolSlugs.map((s) => {
                const t = toolMap[s];
                if (!t) return null;
                return (
                  <Link key={s} href={`/tool/${s}`} className="alt-tool">
                    <span
                      className="alt-logo"
                      style={{ background: t.color || "var(--color-primary)" }}
                    >
                      {t.name.slice(0, 1)}
                    </span>
                    <span className="alt-name">{t.name}</span>
                    <Icon
                      name="ArrowUpRight"
                      size={12}
                      className="inline muted"
                      style={{ marginLeft: "auto" }}
                    />
                  </Link>
                );
              })}
            </section>
          )}
        </div>

        <aside>
          {otherModules.length > 0 && (
            <div className="card aside-card">
              <h3>
                <span className="dot" />
                其他模块
              </h3>
              <div className="lit-lessons">
                {otherModules.map((x) => (
                  <Link
                    key={x.slug}
                    href={`/literacy/${x.slug}`}
                    className="lit-lesson-row"
                  >
                    <span className="n">{x.num}</span>
                    <span className="tt">{x.title}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="card aside-card">
            <h3>
              <span className="dot" />
              合规提示
            </h3>
            <div className="compliance">
              <Icon name="ShieldCheck" size={18} className="ic" />
              <div>
                课程正文在国家中小学智慧教育平台。本站只做导学，不代表官方观点，也不对课程内容的准确性、时效性负责。
              </div>
            </div>
          </div>
        </aside>
      </div>

      <div className="lit-nav">
        {prevMod ? (
          <Link href={`/literacy/${prevMod.slug}`} className="lit-nav-item">
            <Icon name="CaretLeft" size={14} className="inline" /> {prevMod.title}
          </Link>
        ) : (
          <span className="lit-nav-item is-disabled">
            <Icon name="CaretLeft" size={14} className="inline" /> 上一模块
          </span>
        )}
        <Link href="/literacy" className="lit-nav-item">
          返回 AI通识课
        </Link>
        {nextMod ? (
          <Link href={`/literacy/${nextMod.slug}`} className="lit-nav-item">
            {nextMod.title} <Icon name="CaretRight" size={14} className="inline" />
          </Link>
        ) : (
          <span className="lit-nav-item is-disabled">
            下一模块 <Icon name="CaretRight" size={14} className="inline" />
          </span>
        )}
      </div>
    </main>
  );
}
