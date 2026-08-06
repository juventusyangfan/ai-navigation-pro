import { notFound } from "next/navigation";
import Link from "next/link";
import { content } from "@/lib/content";
import SceneTools from "@/components/SceneTools";
import { Icon } from "@/lib/icons";

export const dynamic = 'force-dynamic';

export async function generateStaticParams() {
  try {
    const scenes = await content.getScenes();
    return scenes.map((s) => ({ key: s.key }));
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  const sc = await content.getScene(key);
  return { title: sc ? `${sc.name} · 教AI导航` : "场景 · 教AI导航" };
}

export default async function ScenePage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  const sc = await content.getScene(key);
  if (!sc) notFound();
  const categories = await content.getCategories();
  const catDesc = categories[sc.cat]?.desc ?? "";
  const sopN = (await content.usagesForScene(sc.key)).length;

  return (
    <main className="wrap py-8">
      <div className="crumb">
        <Link href="/">首页</Link> / <Link href="/scenes">全部场景</Link> /{" "}
        <b>{sc.name}</b>
      </div>
      <div className="sec-head">
        <div>
          <h2>
            <Icon name={sc.icon} size={24} className="inline" /> {sc.name}
          </h2>
          <div className="sub">
            {catDesc} · 适用角色：{sc.roles.join("、")}
          </div>
        </div>
      </div>
      <div className="rel-banner">
        <Icon name="Notebook" size={14} className="inline" /> 本场景共 <b>{sopN}</b> 个精选用法 SOP，
        <Link href={`/usages?scene=${sc.key}`}>
          查看分步做法 <Icon name="ArrowRight" size={12} className="inline" />
        </Link>
      </div>
      <SceneTools sceneKey={sc.key} />
    </main>
  );
}
