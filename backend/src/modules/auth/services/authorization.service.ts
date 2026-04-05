import {
  ALL_PERMISSIONS,
  PERMISSION_ID_MAP,
  type Permission,
} from "../types/auth.permission.types.js";

const BASE_PERMISSIONS = [
  "organization:create",
  "auth:delete_self",
] as const satisfies readonly Permission[];

const NON_ASSIGNABLE_ROLE_PERMISSIONS = [
  "organization:create",
  "auth:delete_self",
  "auth:delete",
] as const satisfies readonly Permission[];

export function getBasePermissions(): Permission[] {
  return [...BASE_PERMISSIONS];
}

export function getPermissionCatalog(): {
  permissions: { id: number; key: Permission }[];
  permissionMap: Record<Permission, number>;
} {
  return {
    permissions: ALL_PERMISSIONS
      .map((permission) => ({
        id: PERMISSION_ID_MAP[permission],
        key: permission,
      }))
      .sort((left, right) => left.id - right.id),
    permissionMap: { ...PERMISSION_ID_MAP },
  };
}

export function getAssignablePermissionCatalog(): {
  permissions: { id: number; key: Permission }[];
  permissionMap: Partial<Record<Permission, number>>;
} {
  const blocked = new Set<Permission>(NON_ASSIGNABLE_ROLE_PERMISSIONS);
  const permissions = ALL_PERMISSIONS
    .filter((permission) => !blocked.has(permission))
    .map((permission) => ({
      id: PERMISSION_ID_MAP[permission],
      key: permission,
    }))
    .sort((left, right) => left.id - right.id);

  return {
    permissions,
    permissionMap: Object.fromEntries(
      permissions.map((permission) => [permission.key, permission.id]),
    ) as Partial<Record<Permission, number>>,
  };
}
