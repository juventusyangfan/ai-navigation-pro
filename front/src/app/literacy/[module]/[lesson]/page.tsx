import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { content, type LitLessonDetail } from "@/lib/content";
import { Icon } from "@/lib/icons";
import OfficialSourceNote from "@/components/literacy/OfficialSourceNote";
import OfficialCourseCta from "@/components/literacy/OfficialCourseCta";
import LinkedSopList from "@/components/literacy/LinkedSopList";
import LessonNav from "@/components/literacy/LessonNav";
import LessonInteractions from "@/components/literacy/LessonInteractions";
import LessonBackBar from "@/components/literacy/LessonBackBar";
import LessonViewPing from "@/components/literacy/LessonViewPing";
import LessonJsonLd from "@/components/literacy/LessonJsonLd";

// 伴学页：导学 + 转化核心。诚实转介官方课（外链显眼、新窗口），
// 用「看之前 / 看的时候 / 看完之后」三段式包夹把老师接回来练 SOP。
// ISR 3600 + SSG（generateStaticParams 失败兜底返回 []）。
export const revalidate = 3600;

function hostOf(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}

export async function generateStaticParams() {
  try {
    const { modules, lessons } = await content.getLiteracyIndex();
    return lessons
      .filter((l) => modules.some((m) => m.slug === l.moduleSlug))
      .map((l) => ({ module: l.moduleSlug, lesson: l.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ module: string; lesson: string }>;
}): Promise<Metadata> {
  const { lesson } = await params;
  const l = await content.getLitLesson(lesson);
  if (!l) return { title: "伴学课未找到 · 智用笔记" };
  return {
    title: `${l.title} · AI通识课 · 智用笔记`,
    description: l.hook,
    // canonical 指向本站自己（架构红线②）
    alternates: { canonical: `/literacy/${l.moduleSlug}/${l.slug}` },
    openGraph: {
      title: l.title,
      description: l.hook,
      type: "article",
    },
  };
}

export default async function LessonPage({
  params,
}: {
  params: Promise<{ module: string; lesson: string }>;
}) {
  const { module: moduleSlug, lesson: lessonSlug } = await params;
  const lesson = await content.getLitLesson(lessonSlug);
  if (!lesson || lesson.moduleSlug !== moduleSlug) notFound();

  const host = hostOf(lesson.officialUrl);
  const provider = lesson.officialProvider ?? "国家中小学智慧教育平台";

  // 同模块课时列表（LessonNav 用）
  const mod = await content.getLitModule(moduleSlug);
  const siblings = mod?.lessons ?? [];

  // 工具（从关联 SOP 的工具推导）
  const tools = Array.from(
    new Map(lesson.sops.map((s) => [s.toolSlug, s])).values(),
  );

  // 降级：官方链接失效（broken）时，把动手练区提到官方卡之前
  const degraded = lesson.linkStatus === "broken";

  const mailto = `mailto:hi@eanavi.com?subject=${encodeURIComponent(
    "AI通识课死链反馈",
  )}&body=${encodeURIComponent(
    `课时：${lesson.title}\n路由：/literacy/${moduleSlug}/${lessonSlug}`,
  )}`;

  const OfficialCard = (
    <section className="card lit-official">
      <h3>
        <span className="dot" />
        这节课讲什么
      </h3>
      <p style={{ fontSize: 14 }}>{lesson.guideIntro}</p>
      {lesson.watchPoints.length > 0 && (
        <ul
          style={{
            listStyle: "none",
            display: "flex",
            flexDirection: "column",
            gap: 10,
            marginTop: 12,
          }}
        >
          {lesson.watchPoints.map((w, i) => (
            <li
              key={i}
              style={{
                display: "flex",
                gap: 8,
                alignItems: "flex-start",
                fontSize: 14,
              }}
            >
              <Icon
                name="Lightbulb"
                size={16}
                className="inline"
                style={{ color: "var(--color-primary)", flexShrink: 0, marginTop: 2 }}
              />
              <span>{w}</span>
            </li>
          ))}
        </ul>
      )}
      <OfficialCourseCta
        officialUrl={lesson.officialUrl}
        linkStatus={lesson.linkStatus}
        fallbackUrl={lesson.fallbackUrl}
        archiveNote={lesson.archiveNote}
        provider={provider}
        moduleSlug={moduleSlug}
        lessonSlug={lessonSlug}
      />
      <div style={{ marginTop: 12 }}>
        <a href={mailto} className="muted" style={{ fontSize: 12 }}>
          链接打不开？告诉我们
        </a>
      </div>
    </section>
  );

  const TakeCard = (
    <section className="card lit-take">
      <h3>
        <span className="dot" />
        我们的看法
      </h3>
      <p style={{ fontSize: 14 }}>
        {lesson.editorNote || "（编辑点评更新中，先去看官方课，回来再练 SOP。）"}
      </p>
      <div className="lit-take-sign">
        智用笔记编辑部 · 更新于 {lesson.updatedAt.slice(0, 10)}
      </div>
    </section>
  );

  const PracticeCard = (
    <LinkedSopList sops={lesson.sops} lessonSlug={lesson.slug} />
  );

  return (
    <main className="wrap py-8">
      <LessonJsonLd lesson={lesson as LitLessonDetail} />
      <LessonViewPing kind="lesson" slug={lesson.slug} />

      <nav className="crumb">
        <Link href="/literacy">AI通识课</Link>
        <span>/</span>
        <Link href={`/literacy/${moduleSlug}`}>{lesson.moduleTitle}</Link>
        <span>/</span>
        <b>{lesson.title}</b>
      </nav>

      <LessonBackBar
        moduleSlug={moduleSlug}
        lessonSlug={lessonSlug}
        lessonTitle={lesson.title}
        sopCount={lesson.sops.length}
      />

      <div className="detail-head">
        <div className="detail-tags" style={{ marginBottom: 8 }}>
          <span className="tag">
            {lesson.moduleTitle} · 第 {lesson.order + 1} 节
          </span>
          <span className="lit-tag-src">
            {lesson.source === "official" ? "官方课" : "本站"}
          </span>
        </div>
        <h1>{lesson.title}</h1>
        <p className="detail-tagline">{lesson.hook}</p>
        <div className="detail-tags">
          {lesson.durationMin ? (
            <span className="tag">
              <Icon name="Clock" size={11} className="inline" /> {lesson.durationMin} 分钟
            </span>
          ) : null}
          {lesson.stage ? <span className="tag">{lesson.stage}</span> : null}
          <span className="tag">适合：老师</span>
        </div>

        <OfficialSourceNote provider={provider} host={host} />

        <div className="detail-actions">
          <OfficialCourseCta
            officialUrl={lesson.officialUrl}
            linkStatus={lesson.linkStatus}
            fallbackUrl={lesson.fallbackUrl}
            archiveNote={lesson.archiveNote}
            provider={provider}
            moduleSlug={moduleSlug}
            lessonSlug={lessonSlug}
          />
          <a href="#practice" className="btn btn-ghost">
            先看动手练
            <Icon name="CaretDown" size={12} className="inline" aria-hidden="true" />
          </a>
        </div>
      </div>

      <div className="grid-2">
        <div className="card-stack">
          {/* 降级时把动手练提到最前，官方卡收到最后 */}
          {degraded ? (
            <>
              {PracticeCard}
              {TakeCard}
              {OfficialCard}
            </>
          ) : (
            <>
              {OfficialCard}
              {TakeCard}
              {PracticeCard}
            </>
          )}
        </div>

        <aside>
          <LessonNav
            layout="sidebar"
            lessons={siblings}
            currentSlug={lesson.slug}
            moduleSlug={moduleSlug}
            moduleTitle={lesson.moduleTitle}
          />

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

          {tools.length > 0 && (
            <div className="card aside-card">
              <h3>
                <span className="dot" />
                这节课用到的工具
              </h3>
              {tools.map((s) => (
                <Link
                  key={s.toolSlug}
                  href={`/tool/${s.toolSlug}`}
                  className="alt-tool"
                >
                  <span className="alt-name">{s.toolName}</span>
                  <Icon
                    name="ArrowUpRight"
                    size={12}
                    className="inline muted"
                    style={{ marginLeft: "auto" }}
                  />
                </Link>
              ))}
            </div>
          )}

          <div className="card aside-card">
            <h3>
              <span className="dot" />
              标记这节课
            </h3>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <LessonInteractions
                slug={lesson.slug}
                baseUseful={lesson.usefulCount}
                baseCollect={lesson.collectCount}
              />
            </div>
          </div>
        </aside>
      </div>

      <LessonNav
        layout="footer"
        lessons={siblings}
        currentSlug={lesson.slug}
        moduleSlug={moduleSlug}
        moduleTitle={lesson.moduleTitle}
      />
    </main>
  );
}
