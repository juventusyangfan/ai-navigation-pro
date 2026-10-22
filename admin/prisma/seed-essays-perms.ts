/**
 * 作文测评 / 设备额度（zuowen）· RBAC 权限补丁（幂等，可安全在生产库上执行）
 *
 * ⚠️ 不要用 `npm run db:seed` 加权限！
 *    prisma/seed.ts 开头会 deleteMany 清空 tools / sop_paths / sop_steps 等内容表，
 *    在生产库上执行等于抹掉线上内容。本脚本只 upsert 权限行。
 *
 * 运行：npm run db:seed:essays
 *
 * essays（作文看板）：只给 read
 *   后台对作文数据是**只读看板** —— 不提供删除（删了家长手里的报告就 404），
 *   不提供正文导出（导出文件离开系统后无法追踪）。
 *
 * devices（设备额度，2026-10-22 新增）：editor 可读可写，reviewer 只读
 *   这是后台唯一的写能力：给某台设备放开/收紧每日次数。
 *   不给 reviewer 写权限，是因为它直接控制成本与「谁能免限额」，
 *   和审核员的职责无关，出错代价也不对等。
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const MATRIX: Record<string, { resource: string; action: string }[]> = {
  editor: [
    { resource: "essays", action: "read" },
    { resource: "devices", action: "read" },
    { resource: "devices", action: "write" },
  ],
  reviewer: [
    { resource: "essays", action: "read" },
    { resource: "devices", action: "read" },
  ],
};

async function main() {
  for (const [roleKey, perms] of Object.entries(MATRIX)) {
    const role = await db.role.findUnique({ where: { key: roleKey } });
    if (!role) {
      console.log(`跳过：角色 ${roleKey} 不存在（需先执行 db:seed 初始化角色）`);
      continue;
    }
    for (const p of perms) {
      await db.rolePermission.upsert({
        where: { roleId_resource_action: { roleId: role.id, resource: p.resource, action: p.action } },
        update: {},
        create: { roleId: role.id, resource: p.resource, action: p.action },
      });
    }
    console.log(`✔ ${roleKey}（${role.name}）：${perms.map((p) => `${p.resource}:${p.action}`).join(", ")}`);
  }
  console.log("✅ 作文测评权限补丁完成（super_admin 走通配 *，无需额外配置）");
  console.log("   提醒：admin 的 .env 需同时配置 ZUOWEN_BASE_URL / ZUOWEN_CRON_TOKEN，否则页面会提示「服务未接通」");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
