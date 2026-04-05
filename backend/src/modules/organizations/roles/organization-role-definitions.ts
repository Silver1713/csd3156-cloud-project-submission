import type { Permission } from "../../auth/types/auth.permission.types.js";

export const OWNER_ROLE_NAME = "owner";
export const OWNER_ROLE_LEVEL = 255;
export const MEMBER_ROLE_NAME = "member";
export const MEMBER_ROLE_LEVEL = 20;

export const OWNER_ROLE_PERMISSIONS = [
  "organization:read",
  "organization:update",
  "organization:members:read",
  "organization:members:invite",
  "organization:members:manage",
  "organization:manage",
  "category:create",
  "category:read",
  "category:update",
  "category:delete",
  "product:create",
  "product:read",
  "product:update",
  "product:delete",
  "inventory:read",
  "inventory:update",
  "stockmovement:read",
  "stockmovement:create",
  "alert:manage",
  "auth:read",
  "auth:update",
  "auth:link",
  "auth:manage",
] as const satisfies readonly Permission[];

export const MEMBER_ROLE_PERMISSIONS = [
  "organization:read",
  "category:read",
  "product:read",
  "inventory:read",
  "stockmovement:read",
] as const satisfies readonly Permission[];
