import Link from "next/link";
import { notFound } from "next/navigation";
import { roleClass } from "@/lib/content";
import { content } from "@/lib/content";
import SopPathView from "@/components/SopPathView";
import UsageUsefulCollect from "@/components/UsageUsefulCollect";
import { Icon } from "@/lib/icons";

export async function generateStaticParams() {
  try {
    const us = await content.getUsages();
    return us.map((u) => ({ id: u.id }));
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const u = await content.getUsage(id);
  return { title: u ? `${u.title} · 用法库 · 教AI导航` : "用法 · 教AI导航" };
}

export default async function UsageDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const usage = await content.getUsage(id);
  if (!usage) notFound();

  const toolMap = await content.getToolMap();
  const tool = toolMap[usage.tool];
  const sceneName = await content.getSceneName();
  const sceneLabel = sceneName[usage.scene] || usage.scene;
  const path = tool?.paths.find((p) => p.usageId === usage.id || (p as { id?: string }).id === usage.id);

  return (
    <main className="wrap py-8">
      <div className="crumb">
        <Link href="/usages">用法库</Link> /{" "}
        <Link href={`/scenes/${usage.scene}`}>{sceneLabel}</Link>
        {tool && (
          <>
            {" / "}
            <Link href={`/tool/${tool.slug}`}>{tool.name}</Link>
          </>
        )}
      </div>

      <div className="detail-head">
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
          <span className="pb-cat">{sceneLabel}</span>
          {usage.pick && (
            <span className="editor-pick">
              <Icon name="Star" size={10} weight="fill" className="inline" /> 编辑精选
            </span>
          )}
        </div>
        <h1>{usage.title}</h1>
        <div className="detail-tagline">{usage.summary}</div>

        <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
          <span className={`rb rb-${roleClass(usage.role)}`}>{usage.role}</span>
          <span className="tag">{usage.subj}</span>
          <span className="tag">
            <Icon name="ListNumbers" size={11} className="inline" /> {usage.steps} 步
          </span>
          {tool && (
            <Link
              className="tag"
              style={{ textDecoration: "none" }}
              href={`/tool/${tool.slug}`}
            >
              {tool.name} <Icon name="ArrowUpRight" size={10} className="inline" />
            </Link>
          )}
        </div>

        <div className="detail-actions">
          <UsageUsefulCollect
            usageId={usage.id}
            baseUseful={usage.useful}
            baseCollect={usage.collect}
          />
          {path?.estMinutes && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                color: "var(--muted)",
                fontSize: 13,
              }}
            >
              约 {path.estMinutes} 分钟
            </span>
          )}
          {path?.level && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                color: "var(--muted)",
                fontSize: 13,
              }}
            >
              难度：{path.level}
            </span>
          )}
          {tool && (
            <Link href={`/tool/${tool.slug}`} className="btn btn-sm btn-primary">
              看工具 {tool.name} <Icon name="ArrowUpRight" size={12} className="inline" />
            </Link>
          )}
        </div>
      </div>

      {path ? (
        <SopPathView
          path={path}
          toolSlug={usage.tool}
          usage={usage}
          toolName={tool?.name ?? usage.tool}
        />
      ) : (
        <div className="rel-banner">
          <Icon name="Notebook" size={14} className="inline" /> 该用法的完整 SOP 正在补充中，先去{" "}
          {tool && <Link href={`/tool/${tool.slug}`}>「{tool.name}」工具页</Link>} 看看。
        </div>
      )}
    </main>
  );
}
