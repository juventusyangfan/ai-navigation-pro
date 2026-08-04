import type { AdminUser, Role, RolePermission } from "@prisma/client";

export type AdminWithRole = AdminUser & {
  role: Role & { permissions: RolePermission[] };
};

/**
 * 权限判定。super_admin 拥有全部；editor/reviewer/school_admin 按 role_permissions 表校验。
 * resource/action 为 "*" 表示通配。
 */
export function userCan(
  admin: AdminWithRole,
  resource: string,
  action: string,
): boolean {
  if (admin.role.key === "super_admin") return true;
  return admin.role.permissions.some(
    (p) =>
      (p.resource === "*" || p.resource === resource) &&
      (p.action === "*" || p.action === action),
  );
}
