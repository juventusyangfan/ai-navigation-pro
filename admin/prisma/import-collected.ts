// 仅导入采集块到 SQLite —— 不影响表中已有数据
// 运行：npx tsx prisma/import-collected.ts
import { PrismaClient } from "@prisma/client";
import { COLLECTED_TOOLS } from "./collected-tools";

const db = new PrismaClient();
const json = (v: unknown) => JSON.stringify(v);

async function main() {
  let upserted = 0;
  for (const t of COLLECTED_TOOLS) {
    await db.tool.upsert({
      where: { slug: t.slug },
      update: {
        name: t.name,
        logo: t.logo,
        color: t.color,
        tagline: t.tagline,
        url: t.url,
        roles: json(t.roles),
        scenes: json(t.scenes),
        subjects: json(t.subjects),
        pricing: t.pricing,
        platform: t.platform,
        rating: t.rating,
        pros: json(t.pros),
        cons: json(t.cons),
        compliance: t.compliance,
        alts: json(t.alts),
      },
      create: {
        slug: t.slug,
        name: t.name,
        logo: t.logo,
        color: t.color,
        tagline: t.tagline,
        url: t.url,
        roles: json(t.roles),
        scenes: json(t.scenes),
        subjects: json(t.subjects),
        pricing: t.pricing,
        platform: t.platform,
        rating: t.rating,
        pros: json(t.pros),
        cons: json(t.cons),
        compliance: t.compliance,
        alts: json(t.alts),
        status: "draft",
      },
    });
    upserted++;
  }
  const draftCount = await db.tool.count({ where: { status: "draft" } });
  console.log(`✅ 采集块导入完成：处理 ${upserted} 条，当前 draft 共 ${draftCount} 条`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
