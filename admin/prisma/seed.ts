// 教AI导航 · Admin 种子脚本
// 数据源为 seed-data.ts，导入到 admin 的 Prisma/SQLite。
// 运行：npm run db:init  （prisma db push + 本脚本）
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  TOOLS,
  SCENES,
  CATS,
  USAGES,
  type Tool as FTool,
  type Path as FPath,
  type Step as FStep,
} from "./seed-data";

const db = new PrismaClient();

const json = (v: unknown) => JSON.stringify(v);

async function main() {
  console.log("清空内容表…");
  await db.$transaction([
    db.sopStep.deleteMany(),
    db.sopPath.deleteMany(),
    db.tool.deleteMany(),
    db.scene.deleteMany(),
    db.category.deleteMany(),
  ]);

  console.log("导入分类法…");
  for (const [key, c] of Object.entries(CATS)) {
    const order = Object.keys(CATS).indexOf(key);
    await db.category.create({ data: { key, name: key, icon: c.icon, phase: c.phase, desc: c.desc, order } });
  }
  for (const s of SCENES) {
    await db.scene.create({ data: { key: s.key, name: s.name, cat: s.cat, icon: s.icon, roles: json(s.roles) } });
  }

  console.log("导入工具与 SOP（合并 USAGES → sop_paths）…");
  const usageByPath = new Map(USAGES.map((u) => [u.id, u]));
  for (const t of TOOLS) {
    const tool = await db.tool.create({
      data: {
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
        status: "published",
      },
    });
    for (const p of t.paths as FPath[]) {
      const usage = p.usageId ? usageByPath.get(p.usageId) : undefined;
      const path = await db.sopPath.create({
        data: {
          toolId: tool.id,
          title: p.title,
          summary: p.summary ?? null,
          estMinutes: p.estMinutes ?? null,
          level: p.level ?? null,
          forRole: usage?.role ?? p.forRole ?? null,
          scene: usage?.scene ?? null,
          subj: usage?.subj ?? null,
          isLibraryPick: !!usage?.pick,
          usefulCount: usage?.useful ?? 0,
          collectCount: usage?.collect ?? 0,
          usageId: p.usageId ?? null,
          order: t.paths.indexOf(p),
        },
      });
      for (const s of p.steps as FStep[]) {
        await db.sopStep.create({
          data: {
            pathId: path.id,
            stepOrder: p.steps.indexOf(s),
            goal: s.goal ?? null,
            action: s.action,
            prompt: s.prompt,
            outputSample: s.outputSample,
            mediaType: s.media?.type ?? null,
            mediaUrl: null,
            mediaLabel: s.media?.label ?? null,
            pitfall: s.pitfall ?? null,
            tip: s.tip ?? null,
            branch: s.branch ? json(s.branch) : null,
          },
        });
      }
    }
  }

  console.log("导入 RBAC 角色与权限…");
  const permMatrix: Record<string, { resource: string; action: string }[]> = {
    super_admin: [
      { resource: "*", action: "*" },
    ],
    editor: [
      { resource: "tools", action: "read" },
      { resource: "tools", action: "write" },
      { resource: "tools", action: "delete" },
      { resource: "sops", action: "read" },
      { resource: "sops", action: "write" },
      { resource: "sops", action: "delete" },
      { resource: "taxonomy", action: "read" },
      { resource: "taxonomy", action: "write" },
      { resource: "taxonomy", action: "delete" },
      { resource: "media", action: "read" },
      { resource: "media", action: "write" },
    ],
    reviewer: [
      { resource: "ratings", action: "read" },
      { resource: "ratings", action: "review" },
      { resource: "feedback", action: "read" },
      { resource: "feedback", action: "review" },
      { resource: "submissions", action: "read" },
      { resource: "submissions", action: "review" },
    ],
    school_admin: [
      { resource: "pushes", action: "read" },
      { resource: "pushes", action: "write" },
    ],
  };
  const roleIds: Record<string, string> = {};
  for (const [key, name] of [
    ["super_admin", "超级管理员"],
    ["editor", "编辑"],
    ["reviewer", "审核员"],
    ["school_admin", "学校管理员"],
  ] as const) {
    const role = await db.role.upsert({
      where: { key },
      update: { name },
      create: { key, name },
    });
    roleIds[key] = role.id;
    for (const p of permMatrix[key]) {
      await db.rolePermission.upsert({
        where: { roleId_resource_action: { roleId: role.id, resource: p.resource, action: p.action } },
        update: {},
        create: { roleId: role.id, resource: p.resource, action: p.action },
      });
    }
  }

  console.log("创建默认管理员账号（admin@ea.test / admin123）…");
  const hash = await bcrypt.hash("admin123", 10);
  await db.adminUser.upsert({
    where: { email: "admin@ea.test" },
    update: { passwordHash: hash, roleId: roleIds.super_admin, status: "active" },
    create: {
      email: "admin@ea.test",
      name: "超级管理员",
      passwordHash: hash,
      roleId: roleIds.super_admin,
      status: "active",
    },
  });

  const counts = {
    tools: await db.tool.count(),
    paths: await db.sopPath.count(),
    steps: await db.sopStep.count(),
    picks: await db.sopPath.count({ where: { isLibraryPick: true } }),
    roles: await db.role.count(),
  };
  console.log("✅ 种子完成：", counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
