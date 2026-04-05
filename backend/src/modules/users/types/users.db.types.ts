export type UserAccountRow = {
  id: string;
  org_id: string;
  profile_url: string | null;
  profile_object_key: string | null;
  name: string | null;
  email: string;
  username: string;
  auth_provider: "backend" | "cognito";
  cognito_sub: string | null;
  role_id: string | null;
  created_at: Date;
  updated_at: Date;
};

export type UserRoleRow = {
  id: string;
  org_id: string;
  name: string;
  created_at: Date;
};

export type UserRolePermissionRow = {
  role_id: string;
  permission: string;
};

export type UserOrganizationRow = {
  id: string;
  name: string | null;
};
