import type { AuthProvider } from "./auth.provider.types.js";

export type AuthAccount = {
  id: string;
  orgId: string;
  profileUrl: string | null;
  name: string | null;
  username: string;
  email: string;
  authProvider: AuthProvider;
  cognitoSub: string | null;
  roleId: string | null;
  passwordHash: string | null;
};

export type PublicAuthAccount = Omit<AuthAccount, "passwordHash">;
