import { eq } from "drizzle-orm";
import type { Role } from "@/lib/auth/rbac";
import { db } from "@/lib/db/client";
import { appSettings } from "@/lib/db/schema";
import {
  normalizePermissions,
  permissionRoleFromAuthRole,
  rolePermissionsSettingsKey,
  type PermissionKey,
  type PermissionRecord
} from "@/lib/permissions";

export async function getRolePermissions(): Promise<PermissionRecord[]> {
  try {
    const [record] = await db
      .select({ value: appSettings.value })
      .from(appSettings)
      .where(eq(appSettings.key, rolePermissionsSettingsKey))
      .limit(1);

    return normalizePermissions(record?.value);
  } catch (error) {
    console.warn("[permissions] using defaults", error);
    return normalizePermissions(null);
  }
}

export async function saveRolePermissions(input: unknown) {
  const permissions = normalizePermissions(input);

  await db
    .insert(appSettings)
    .values({
      key: rolePermissionsSettingsKey,
      value: permissions as unknown as Record<string, unknown>
    })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: {
        value: permissions as unknown as Record<string, unknown>,
        updated_at: new Date()
      }
    });

  return permissions;
}

export async function canRole(role: Role, permissionKey: PermissionKey) {
  if (role === "super_admin") {
    return true;
  }

  const permissionRole = permissionRoleFromAuthRole(role);
  const permissions = await getRolePermissions();
  const permission = permissions.find((item) => item.key === permissionKey);

  return Boolean(permission?.[permissionRole]);
}

export async function assertPermission(role: Role, permissionKey: PermissionKey) {
  if (!(await canRole(role, permissionKey))) {
    throw new Error("Sem permissao para executar esta acao.");
  }
}
