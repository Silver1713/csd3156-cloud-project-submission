import type {
  AuthenticatedAccountContext,
  CognitoAuthContext,
} from "../modules/auth/types/auth.request.types.js";
import type { OrganizationAccessContext } from "../modules/organizations/types/organizations.account.types.js";

declare global {
  namespace Express {
    interface Request {
      authAccount?: AuthenticatedAccountContext;
      cognitoAuth?: CognitoAuthContext;
      organizationAccessContext?: OrganizationAccessContext;
    }
  }
}

export {};
