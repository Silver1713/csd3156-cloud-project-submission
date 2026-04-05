import type { PublicAuthAccount } from "./auth.account.types.js";
import type { AuthProvider } from "./auth.provider.types.js";

export type LoginCommand = {
  username: string;
  password: string;
};

export type LoginResult = {
  accessToken: string;
  account: PublicAuthAccount;
};

export type CognitoAuthResult = {
  provider: "cognito";
  configured: boolean;
  message: string;
};

export type VerifyCognitoCommand = {
  accessToken: string;
};

export type RefreshCognitoCommand = {
  refreshToken: string;
};

export type ResolveCognitoSessionCommand = {
  accessToken: string;
  idToken: string;
  joinKey?: string | null | undefined;
};

export type CognitoLoginResult = {
  provider: "cognito";
  account: PublicAuthAccount | null;
  accessToken: string;
  idToken: string | null;
  refreshToken: string | null;
};

export type CognitoRefreshResult = {
  provider: "cognito";
  accessToken: string;
  idToken: string | null;
  refreshToken: string | null;
  expiresIn: number | null;
  tokenType: string | null;
};

export type CognitoRegisterResult = {
  provider: "cognito";
  account: PublicAuthAccount;
  userSub: string;
  userConfirmed: boolean;
};

export type CognitoVerifyResult = {
  provider: "cognito";
  verified: true;
  account: PublicAuthAccount | null;
  claims: {
    sub: string;
    email?: string;
    tokenUse: "access" | "id";
    username?: string;
    cognitoUsername?: string;
  };
};

export type CognitoResolveResult = {
  provider: "cognito";
  verified: true;
  provisioned: boolean;
  account: PublicAuthAccount;
  claims: {
    sub: string;
    email?: string;
    tokenUse: "access" | "id";
    username?: string;
    cognitoUsername?: string;
  };
};

export type RegisterCommand = {
  orgId: string;
  email: string;
  username: string;
  password: string;
  roleId?: string | null | undefined;
};

export type CreateAccountInput = {
  orgId: string;
  email: string;
  username: string;
  authProvider: AuthProvider;
  cognitoSub: string | null;
  passwordHash: string | null;
  roleId: string | null;
};

export type RegisterResult = {
  account: PublicAuthAccount;
};

export type DeleteMyAccountResult = {
  deletedAccountId: string;
  deletedOrganizationId: string | null;
  organizationDeleted: boolean;
};
