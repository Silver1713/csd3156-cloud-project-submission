export type ListOrganizationMembersCommand = {
  orgId: string;
};

export type GetOrganizationAccessContextCommand = {
  accountId: string;
};

export type CreateOrganizationCommand = {
  name: string;
};

export type UpdateOrganizationCommand = {
  organizationId: string;
  name?: string;
  criticalStockThreshold?: number;
  lowStockThreshold?: number;
};

export type DeleteOrganizationCommand = {
  organizationId: string;
};

export type CreateOrganizationRoleCommand = {
  name: string;
  level: number;
  permissions: string[];
};

export type UpdateOrganizationMemberCommand = {
  accountId: string;
  roleId: string | null;
};

export type RemoveOrganizationMemberCommand = {
  accountId: string;
};

export type JoinOrganizationCommand = {
  joinKey: string;
};
