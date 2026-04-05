import type { AuthProvider } from "./auth.provider.types.js";

export type AuthAccountRow = {
  id: string;
  org_id: string;
  profile_url: string | null;
  profile_object_key: string | null;
  name: string | null;
  email: string;
  username: string;
  auth_provider: AuthProvider;
  cognito_sub: string | null;
  password_hash: string | null;
  role_id: string | null;
  created_at: Date;
  updated_at: Date;
};

export type OrganizationRow = {
  id: string;
  name: string | null;
};

export type RoleRow = {
  id: string;
  org_id: string;
  name: string;
  created_at: Date;
};

export type RolePermissionRow = {
  role_id: string;
  permission: string;
};
