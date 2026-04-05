import type { Permission } from "./auth.permission.types.js";

export type AuthenticatedUser = {
  userId: string;
  orgId: string;
  username: string;
  roleName: string;
  permissions: Permission[];
};

export type JwtClaims = {
  sub: string;
  orgId: string;
  username: string;
  roleName: string;
  permissions: Permission[];
};
