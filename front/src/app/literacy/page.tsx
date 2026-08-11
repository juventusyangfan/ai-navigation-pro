import Link from "next/link";
import { content, type LitLessonCard, type LitModuleCard } from "@/lib/content";
import { Icon } from "@/lib/icons";
import ToolCard from "@/components/ToolCard";
import ModuleCard from "@/components/literacy/ModuleCard";

// 落地页：首屏说完「国家平台讲原理、本站配练习」的桥接定位，
// 再用配对条 / 分诊台 / 模块卡三块把老师引到对症的伴学课。
// ISR 300：数据来自 admin API，失败由 safeFetch 兜底为空，页面不会崩。
export const revalidate = 300;

export const metadata = {
  title: "AI通识课 · 智用笔记",
  description:
    "国家平台讲 AI 原理课，智用笔记给每节课配一句「你为什么要看」、一段本土化点评，和看完就能上手的分步 SOP。面向中小学教师的 AI 通识导学。",
};

// 分诊台：痛点 → 对症模块的首节。按模块顺序索引，数据驱动，seed 改动也不崩。
const TRIAGE: { pain: string; moduleIdx: number }[] = [
  { pain: "完全没碰过，怕在课堂上说错话", moduleIdx: 0 },
  { pain: "会用，但它老是答非所问", moduleIdx: 1 },
  { pain: "学生数据能不能喂给 AI，我心里没底", moduleIdx: 2 },
  { pain: "下周就开学，我要能直接用的东西", moduleIdx: 3 },
];

export default async function LiteracyPage() {
  const [data, toolMap] = await Promise.all([
    content.getLiteracyIndex(),
    content.getToolMap(),
  ]);
  const modules = data.modules as LitModuleCard[];
  const lessons = data.lessons as LitLessonCard[];

  // 按模块分组课时
  const byModule = new Map<string, LitLessonCard[]>();
  for (const l of lessons) {
    const arr = byModule.get(l.moduleSlug) ?? [];
    arr.push(l);
    byModule.set(l.moduleSlug, arr);
  }

  // 统计自动统计（不硬编码，避免过期）
  const officialCount = lessons.filter((l) => l.source === "official").length;
  const sopCount = lessons.reduce((s, l) => s + l.sopCount, 0);

  // 相关工具：所有模块 toolSlugs 并集
  const toolSlugs = Array.from(new Set(modules.flatMap((m) => m.toolSlugs)));
  const relTools = toolSlugs
    .map((s) => toolMap[s])
    .filter(Boolean);

  return (
    <main className="wrap">
      <div className="rel-banner">
        <Icon name="GraduationCap" size={14} className="inline" /> <b>AI通识课</b>{" "}
        是「国家平台的课 + 本站的动手练」；只想找工具去{" "}
        <Link href="/scenes">
          全部场景 <Icon name="ArrowRight" size={12} className="inline" />
        </Link>
        ，只想抄步骤去{" "}
        <Link href="/usages">
          用法库 <Icon name="ArrowRight" size={12} className="inline" />
        </Link>
      </div>

      <section className="lit-hero">
        <h1>AI通识课</h1>
        <p>
          课不是我们讲的。原理课在国家中小学智慧教育平台上，官方、免费、有视频；我们做的是给每节课配一句「你为什么要看」、一段本土化点评，和看完就能上手的分步
          SOP。
        </p>
        <div className="lit-stats">
          <span>
            <Icon name="BookOpen" size={13} className="inline" /> {modules.length} 个模块
          </span>
          <span>
            <Icon name="PlayCircle" size={13} className="inline" /> {lessons.length} 节已发布
          </span>
          <span>
            <Icon name="LinkSimple" size={13} className="inline" /> {officialCount} 节官方课
          </span>
          <span>
            <Icon name="ListNumbers" size={13} className="inline" /> {sopCount} 条配套 SOP
          </span>
        </div>
      </section>

      <section className="block">
        <div className="lit-bridge">
          <div className="lit-bridge-side">
            <Icon name="Bank" size={20} className="ic" />
            <div className="t">国家中小学智慧教育平台</div>
            <div className="d">讲「是什么 / 为什么」</div>
            <div className="d">官方 · 免费 · 有视频</div>
            <div className="u">basic.smartedu.cn ↗</div>
          </div>
          <div className="lit-bridge-arrow">
            <Icon name="ArrowRight" size={20} className="inline" />
          </div>
          <div className="lit-bridge-side is-ours">
            <Icon name="Wrench" size={20} className="ic" />
            <div className="t">智用笔记（本站）</div>
            <div className="d">给「打开就能做」的步骤</div>
            <div className="d">{sopCount} 条 SOP · 一线老师亲测</div>
            <div className="u">每节课都配好了</div>
          </div>
        </div>
        <p className="muted" style={{ fontSize: 13, marginTop: 14 }}>
          下面每一节，都是「官方课 + 我们配的动手练」的一对。
        </p>
      </section>

      <section className="block">
        <div className="sec-head">
          <div>
            <h2>课程路径</h2>
            <div className="sub">
              {modules.length} 个模块，从建立预期到开学能用
            </div>
          </div>
        </div>
        <div className="lit-mods">
          {modules.map((m) => (
            <ModuleCard
              key={m.slug}
              module={m}
              lessons={byModule.get(m.slug) ?? []}
              tools={(m.toolSlugs.map((s) => toolMap[s]).filter(Boolean) as {
                slug: string;
                name: string;
              }[])}
            />
          ))}
        </div>
      </section>

      <section className="block">
        <div className="sec-head">
          <div>
            <h2>你现在卡在哪儿？</h2>
            <div className="sub">直接跳到对症的那一节</div>
          </div>
        </div>
        <div>
          {TRIAGE.map((t) => {
            const m = modules[t.moduleIdx];
            if (!m) return null;
            const first = (byModule.get(m.slug) ?? [])
              .slice()
              .sort((a, b) => a.order - b.order)[0];
            if (!first) return null;
            return (
              <Link
                key={t.moduleIdx}
                href={`/literacy/${first.moduleSlug}/${first.slug}`}
                className="lit-entry"
              >
                <span className="pain">{t.pain}</span>
                <span className="to">
                  {m.num}·{first.title} <Icon name="ArrowRight" size={13} className="inline" />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {relTools.length > 0 && (
        <section className="block">
          <div className="sec-head">
            <div>
              <h2>本路径相关工具</h2>
              <div className="sub">点开任一工具，看它的分步使用路径</div>
            </div>
            <Link className="link-more" href="/scenes">
              按场景找更多 <Icon name="ArrowRight" size={12} className="inline" />
            </Link>
          </div>
          <div className="tool-grid">
            {relTools.map((t) => (
              <ToolCard key={t.slug} tool={t} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
