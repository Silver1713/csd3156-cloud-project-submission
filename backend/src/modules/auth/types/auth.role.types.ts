import type { Permission } from "./auth.permission.types.js";

export type Role = {
  id: string;
  orgId: string;
  name: string;
};

export type RoleWithPermissions = Role & {
  permissions: Permission[];
};
