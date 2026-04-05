export type OrganizationRow = {
  id: string;
  name: string | null;
  join_key: string;
  critical_stock_threshold: number;
  low_stock_threshold: number;
};

export type OrganizationRoleRow = {
  id: string;
  org_id: string;
  name: string;
  level: number;
  created_at: Date;
};

export type OrganizationRolePermissionRow = {
  role_id: string;
  permission: string;
};

export type OrganizationAccessContextRow = {
  account_id: string;
  org_id: string;
  org_name: string | null;
  org_join_key: string;
  org_critical_stock_threshold: number;
  org_low_stock_threshold: number;
  role_id: string | null;
  role_name: string | null;
  role_level: number | null;
};

export type OrganizationMemberRow = {
  account_id: string;
  org_id: string;
  email: string;
  username: string;
  name: string | null;
  profile_url: string | null;
  profile_object_key: string | null;
  auth_provider: string;
  cognito_sub: string | null;
  role_id: string | null;
  role_name: string | null;
  created_at: Date;
  updated_at: Date;
};
