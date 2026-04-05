import type { AuthProvider } from "../../auth/types/auth.provider.types.js";
import type { Permission } from "../../auth/types/auth.permission.types.js";

export type OrganizationSummary = {
  id: string;
  name: string | null;
  joinKey: string | null;
  criticalStockThreshold: number;
  lowStockThreshold: number;
  capabilities: {
    canDeleteOrganization: boolean;
    canRegenerateJoinKey: boolean;
    canViewJoinKey: boolean;
  };
};

export type OrganizationRole = {
  id: string;
  orgId: string;
  name: string;
  level: number;
  createdAt: string;
};

export type OrganizationRoleWithPermissions = OrganizationRole & {
  permissions: Permission[];
};

export type OrganizationMember = {
  accountId: string;
  orgId: string;
  email: string;
  username: string;
  name: string | null;
  profileUrl: string | null;
  authProvider: AuthProvider;
  cognitoSub: string | null;
  roleId: string | null;
  roleName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OrganizationAccessContext = {
  accountId: string;
  organization: OrganizationSummary;
  role: OrganizationRoleWithPermissions | null;
};
