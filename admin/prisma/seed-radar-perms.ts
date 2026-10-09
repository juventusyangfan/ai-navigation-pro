/**
 * 赛事雷达 · RBAC 权限补丁（幂等，可安全在生产库上执行）
 *
 * ⚠️ 不要用 `npm run db:seed` 来加权限！
 *    prisma/seed.ts 开头会 deleteMany 清空 tools / sop_paths / sop_steps 等内容表，
 *    在生产库上执行等于抹掉线上内容。本脚本只 upsert 权限行，不动任何业务数据。
 *
 * 运行：npm run db:seed:radar
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const MATRIX: Record<string, { resource: string; action: string }[]> = {
  // 编辑：可导入、编辑、发布、下架。发布动作需要 radar:write。
  editor: [
    { resource: "radar", action: "read" },
    { resource: "radar", action: "write" },
    { resource: "radar", action: "delete" },
  ],
  // 审核员：只读。承接「审核权不能自审自发」——reviewer 不得拿到雷达写权限。
  reviewer: [{ resource: "radar", action: "read" }],
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
  console.log("✅ 雷达权限补丁完成（super_admin 走通配 *，无需额外配置）");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
