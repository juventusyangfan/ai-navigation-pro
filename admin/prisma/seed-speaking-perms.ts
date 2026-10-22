/**
 * 英语测评额度（H5）· RBAC 权限补丁（幂等，可安全在生产库上执行）
 *
 * ⚠️ 不要用 `npm run db:seed` 加权限！
 *    prisma/seed.ts 开头会 deleteMany 清空 tools / sop_paths / sop_steps 等内容表。
 *    本脚本只 upsert 权限行，不动任何业务数据。
 *
 * 运行：npm run db:seed:speaking
 *
 * speaking（英语测评额度）：editor 可读可写，reviewer 只读
 *   为什么和 devices 一样给 write：它同样直接控制「谁能免限额」，属于运营动作。
 *   为什么不给 reviewer：审核员的职责是看内容，改额度会让成本与权限边界混在一起；
 *   reviewer 只需要能查到「这台设备为什么用不了」，读就够了。
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const MATRIX: Record<string, { resource: string; action: string }[]> = {
  editor: [
    { resource: "speaking", action: "read" },
    { resource: "speaking", action: "write" },
  ],
  reviewer: [{ resource: "speaking", action: "read" }],
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
  console.log("✅ 英语测评额度权限补丁完成（super_admin 走通配 *，无需额外配置）");
  console.log("   提醒：admin 的 .env 需配置 H5_BASE_URL / H5_INTERNAL_TOKEN，否则页面会提示「服务未接通」");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
