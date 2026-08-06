import { notFound } from "next/navigation";
import Link from "next/link";
import {
  roleClass,
  pricingLabel,
} from "@/lib/content";
import { content } from "@/lib/content";
import SopTabs from "@/components/SopTabs";
import FeedbackBox from "@/components/FeedbackBox";
import StarRating from "@/components/StarRating";
import ToolRating from "@/components/ToolRating";
import FavButton from "@/components/FavButton";
import ToolUsefulButton from "@/components/ToolUsefulButton";
import { Icon } from "@/lib/icons";
import ToolLogo from "@/components/ToolLogo";

export const dynamic = 'force-dynamic';

export async function generateStaticParams() {
  try {
    const toolMap = await content.getToolMap();
    return Object.keys(toolMap).map((slug) => ({ slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const t = await content.getTool(slug);
  return { title: t ? `${t.name} · 教AI导航` : "工具 · 教AI导航" };
}

export default async function ToolPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const t = await content.getTool(slug);
  if (!t) notFound();
  const toolMap = await content.getToolMap();
  const alts = t.alts.map((s) => toolMap[s]).filter(Boolean);
  const sopToolList = await content.usagesForTool(t.slug);

  return (
    <main className="wrap py-8">
      <div className="crumb">
        <Link href="/">首页</Link> / <Link href="/scenes">全部场景</Link> /{" "}
        <b>{t.name}</b>
      </div>

      <div className="detail-head">
        <div className="detail-logo">
          <ToolLogo logo={t.logo} name={t.name} color={t.color} />
        </div>
        <div style={{ flex: 1 }}>
          <h1>{t.name}</h1>
          <div className="detail-tagline">{t.tagline}</div>
          <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
            {t.roles.map((r) => (
              <span key={r} className={`rb rb-${roleClass(r)}`}>
                {r}
              </span>
            ))}
            <span className={`price ${t.pricing}`}>{pricingLabel(t.pricing)}</span>
            <span className="tag">{t.platform}</span>
          </div>
          <div className="detail-actions">
            <a
              href={t.url}
              target="_blank"
              rel="noreferrer"
              className="btn btn-sm btn-primary"
            >
              前往官网 <Icon name="ArrowUpRight" size={12} className="inline" />
            </a>
            <FavButton slug={t.slug} name={t.name} inline />
            <ToolUsefulButton slug={t.slug} baseUseful={t.useful} />
            <span className="text-muted" style={{ fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 6 }}>
              <StarRating value={t.rating} size={13} showNumber /> · {t.subjects.join("/")}
            </span>
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <h3>
            <span className="dot" />
            使用路径 SOP
          </h3>
          {t.paths.length ? (
            <SopTabs paths={t.paths} toolSlug={t.slug} />
          ) : (
            <p className="text-muted">该工具暂无分步用法，欢迎投稿补充。</p>
          )}
        </div>

        <div>
          <div className="card aside-card">
            <h3>
              <span className="dot" />
              替代方案
            </h3>
            {alts.length ? (
              alts.map((a) => (
                <Link key={a.slug} href={`/tool/${a.slug}`} className="alt-tool">
                  <div className="alt-logo">
                    <ToolLogo logo={a.logo} name={a.name} color={a.color} />
                  </div>
                  <div>
                    <div className="alt-name">{a.name}</div>
                    <div className="alt-tag">{a.tagline}</div>
                  </div>
                </Link>
              ))
            ) : (
              <p className="text-muted">暂无推荐替代。</p>
            )}
          </div>

          <div className="card aside-card">
            <h3>
              <span className="dot" />
              合规提示
            </h3>
            <div className="compliance">
              <span className="ic">
                <Icon name="ShieldCheck" size={16} />
              </span>
              <span>{t.compliance}</span>
            </div>
            <ToolRating slug={t.slug} aggregate={t.rating} />
          </div>

          <div className="card aside-card">
            <h3>
              <span className="dot" />
              优缺点
            </h3>
            <div className="pros-cons">
              <ul className="pc-list pro">
                {t.pros.map((p) => (
                  <li key={p}>
                    <span className="mk">+</span>
                    {p}
                  </li>
                ))}
              </ul>
              <ul className="pc-list con">
                {t.cons.map((c) => (
                  <li key={c}>
                    <span className="mk">-</span>
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <h3>
          <span className="dot" />
          相关用法 SOP（{sopToolList.length}）
        </h3>
        {sopToolList.length ? (
          <div className="pb-tags">
            {sopToolList.map((u) => (
              <Link
                key={u.id}
                href={`/usages?scene=${u.scene}`}
                className="tag scene"
              >
                {u.title}
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-muted">
            暂无。去 <Link href="/usages" className="text-primary">用法库</Link>{" "}
            看看其他场景。
          </p>
        )}
      </div>

      <FeedbackBox toolSlug={t.slug} toolName={t.name} />
    </main>
  );
}
