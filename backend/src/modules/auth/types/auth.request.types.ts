import type { CognitoJwtPayload } from "../cognito.helper.js";
import type { AuthAccountRow } from "./auth.db.types.js";
import type { PublicAuthAccount } from "./auth.account.types.js";

export type CognitoAuthContext = {
  accessToken: string;
  claims: CognitoJwtPayload;
  account: AuthAccountRow;
};

export type AuthenticatedAccountContext = PublicAuthAccount;
