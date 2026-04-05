/**
 * Owns authentication entry points for both legacy backend auth and Cognito,
 * plus account provisioning and self-service account deletion rules.
 */
import {
  findAccountByCognitoSub,
  createAccount,
  createAccountInTransaction,
  clearAccountRoleInTransaction,
  deleteAccountInTransaction,
  getAllAccounts,
  findAccountById,
  findAccountByUsername,
} from "../repositories/auth.repository.js";
import {
  getCognitoConfig,
  isCognitoConfigured,
  verifyCognitoAccessToken,
  verifyCognitoIdToken,
} from "../cognito.helper.js";
import {
  AdminInitiateAuthCommand,
  getCognitoIdentityProviderClient,
  InitiateAuthCommand,
  SignUpCommand,
} from "../cognito-idp.client.js";
import { pool } from "../../../db/client.js";
import {
  assignRolePermissionsInTransaction,
  createOrganizationInTransaction,
  deleteOrganizationInTransaction,
  findLowestNonOwnerRoleInTransaction,
  createRoleInTransaction,
  findOrganizationByJoinKeyInTransaction,
  findOrganizationByNameInTransaction,
  findRoleByNameInTransaction,
  listOrganizationMembers,
  findRoleById,
} from "../../organizations/repositories/organizations.repository.js";
import {
  MEMBER_ROLE_LEVEL,
  MEMBER_ROLE_NAME,
  MEMBER_ROLE_PERMISSIONS,
  OWNER_ROLE_NAME,
  OWNER_ROLE_LEVEL,
  OWNER_ROLE_PERMISSIONS,
} from "../../organizations/roles/organization-role-definitions.js";
import {
  createOrganizationWithGeneratedJoinKeyInTransaction,
  isOrganizationJoinKeyValid,
  normalizeOrganizationJoinKey,
} from "../../organizations/utils/join-key.js";
import type { PublicAuthAccount } from "../types/auth.account.types.js";
import type {
  CognitoAuthResult,
  CognitoLoginResult,
  CognitoRefreshResult,
  CognitoResolveResult,
  CognitoRegisterResult,
  CognitoVerifyResult,
  CreateAccountInput,
  DeleteMyAccountResult,
  RefreshCognitoCommand,
  LoginCommand,
  LoginResult,
  ResolveCognitoSessionCommand,
  RegisterCommand,
  RegisterResult,
  VerifyCognitoCommand,
} from "../types/auth.command.types.js";
import type { AuthAccountRow } from "../types/auth.db.types.js";
import {
  AccountDeletionBlockedError,
  AccountNotFoundError,
  InvalidCredentialsError,
  UsernameAlreadyExistsError,
} from "../types/auth.errors.types.js";
import jwt from "jsonwebtoken";
import type { PoolClient } from "pg";
import type { CognitoJwtPayload } from "../cognito.helper.js";
import type { OrganizationRow } from "../../organizations/types/organizations.db.types.js";
import { resolveStoredImageUrl } from "../../uploads/services/uploads.service.js";

type TransactionClientLike = {
  query: <Row = unknown>(
    text: string,
    values?: readonly unknown[],
  ) => Promise<{ rows: Row[] }>;
  release: () => void;
};

type DemoDefaultOrganizationConfig = {
  enabled: boolean;
  organizationName: string;
  roleName: string;
};

type VerifyWithCognitoDependencies = {
  isCognitoConfigured: () => boolean;
  verifyCognitoAccessToken: (token: string) => Promise<CognitoJwtPayload>;
  findAccountByCognitoSub: (cognitoSub: string) => Promise<AuthAccountRow | null>;
};

type ResolveCognitoSessionDependencies = VerifyWithCognitoDependencies & {
  getDemoDefaultOrganizationConfig: () => DemoDefaultOrganizationConfig;
  verifyCognitoIdToken: (token: string) => Promise<CognitoJwtPayload>;
  getTransactionalClient: () => Promise<TransactionClientLike>;
  findOrganizationByNameInTransaction: (
    client: TransactionClientLike,
    name: string,
  ) => Promise<{ id: string; name: string | null } | null>;
  findOrganizationByJoinKeyInTransaction: (
    client: TransactionClientLike,
    joinKey: string,
  ) => Promise<{ id: string; name: string | null; join_key: string } | null>;
  findRoleByNameInTransaction: (
    client: TransactionClientLike,
    orgId: string,
    name: string,
  ) => Promise<{ id: string } | null>;
  findLowestNonOwnerRoleInTransaction: (
    client: TransactionClientLike,
    orgId: string,
  ) => Promise<{ id: string } | null>;
  createOrganizationInTransaction: (
    client: TransactionClientLike,
    name: string,
    joinKey: string,
  ) => Promise<OrganizationRow>;
  createRoleInTransaction: (
    client: TransactionClientLike,
    orgId: string,
    name: string,
    level: number,
  ) => Promise<{ id: string }>;
  assignRolePermissionsInTransaction: (
    client: TransactionClientLike,
    roleId: string,
    permissions: readonly string[],
  ) => Promise<void>;
  createAccountInTransaction: (
    client: TransactionClientLike,
    input: CreateAccountInput,
  ) => Promise<AuthAccountRow>;
};

type RefreshWithCognitoDependencies = {
  isCognitoConfigured: () => boolean;
  getCognitoIdentityProviderClient: typeof getCognitoIdentityProviderClient;
  getCognitoConfig: typeof getCognitoConfig;
};

type DeleteMyAccountDependencies = {
  getTransactionalClient: () => Promise<TransactionClientLike>;
  findAccountById: (accountId: string) => Promise<AuthAccountRow | null>;
  listOrganizationMembers: (
    orgId: string,
  ) => Promise<
    {
      account_id: string;
      role_id: string | null;
    }[]
  >;
  findRoleById: (
    roleId: string,
  ) => Promise<{ id: string; level: number } | null>;
  clearAccountRoleInTransaction: (
    client: TransactionClientLike,
    accountId: string,
  ) => Promise<AuthAccountRow | null>;
  deleteAccountInTransaction: (
    client: TransactionClientLike,
    accountId: string,
  ) => Promise<AuthAccountRow | null>;
  deleteOrganizationInTransaction: (
    client: TransactionClientLike,
    orgId: string,
  ) => Promise<OrganizationRow | null>;
};

const verifyWithCognitoDependencies: VerifyWithCognitoDependencies = {
  isCognitoConfigured,
  verifyCognitoAccessToken,
  findAccountByCognitoSub,
};

const resolveCognitoSessionDependencies: ResolveCognitoSessionDependencies = {
  ...verifyWithCognitoDependencies,
  getDemoDefaultOrganizationConfig,
  verifyCognitoIdToken,
  getTransactionalClient: () => pool.connect(),
  findOrganizationByNameInTransaction: (client, name) =>
    findOrganizationByNameInTransaction(client as PoolClient, name),
  findOrganizationByJoinKeyInTransaction: (client, joinKey) =>
    findOrganizationByJoinKeyInTransaction(client as PoolClient, joinKey),
  findRoleByNameInTransaction: (client, orgId, name) =>
    findRoleByNameInTransaction(client as PoolClient, orgId, name),
  findLowestNonOwnerRoleInTransaction: (client, orgId) =>
    findLowestNonOwnerRoleInTransaction(client as PoolClient, orgId),
  createOrganizationInTransaction: (client, name, joinKey) =>
    createOrganizationInTransaction(client as PoolClient, name, joinKey),
  createRoleInTransaction: (client, orgId, name, level) =>
    createRoleInTransaction(client as PoolClient, orgId, name, level),
  assignRolePermissionsInTransaction: (client, roleId, permissions) =>
    assignRolePermissionsInTransaction(
      client as PoolClient,
      roleId,
      permissions,
    ),
  createAccountInTransaction: (client, input) =>
    createAccountInTransaction(client as PoolClient, input),
};

const refreshWithCognitoDependencies: RefreshWithCognitoDependencies = {
  isCognitoConfigured,
  getCognitoIdentityProviderClient,
  getCognitoConfig,
};

const deleteMyAccountDependencies: DeleteMyAccountDependencies = {
  getTransactionalClient: () => pool.connect(),
  findAccountById,
  listOrganizationMembers,
  findRoleById,
  clearAccountRoleInTransaction: (client, accountId) =>
    clearAccountRoleInTransaction(client as PoolClient, accountId),
  deleteAccountInTransaction: (client, accountId) =>
    deleteAccountInTransaction(client as PoolClient, accountId),
  deleteOrganizationInTransaction: (client, orgId) =>
    deleteOrganizationInTransaction(client as PoolClient, orgId),
};

async function mapAccountRowToPublicAccount(account: AuthAccountRow): Promise<PublicAuthAccount> {
  return {
    id: account.id,
    orgId: account.org_id,
    profileUrl: await resolveStoredImageUrl(
      account.profile_object_key,
      account.profile_url,
    ),
    name: account.name,
    username: account.username,
    email: account.email,
    authProvider: account.auth_provider,
    cognitoSub: account.cognito_sub,
    roleId: account.role_id,
  };
}

/**
 * Authenticates a locally managed account and returns a signed backend token.
 */
export async function loginWithBackend(
  command: LoginCommand,
): Promise<LoginResult> {
  const account = await findAccountByUsername(command.username);

  if (
    account?.auth_provider !== "backend" ||
    !account.password_hash ||
    command.password !== account.password_hash
  ) {
    throw new InvalidCredentialsError();
  }

  return {
    accessToken: signBackendAccessToken(account),
    account: await mapAccountRowToPublicAccount(account),
  };
}

const { decode, sign, verify } = jwt;

/**
 * Registers a locally managed account for backend-auth mode.
 */
export async function registerWithBackend(
  command: RegisterCommand,
): Promise<RegisterResult> {
  const existingByUsername = await findAccountByUsername(command.username);

  if (existingByUsername) {
    throw new UsernameAlreadyExistsError();
  }

  const input: CreateAccountInput = {
    orgId: command.orgId,
    email: command.email.trim().toLowerCase(),
    username: command.username.trim(),
    authProvider: "backend",
    cognitoSub: null,
    passwordHash: command.password,
    roleId: command.roleId ?? null,
  };

  const account = await createAccount(input);

  return {
    account: await mapAccountRowToPublicAccount(account),
  };
}

function decodeTokenPayload(token: string): Record<string, unknown> {
  const payload = decode(token);

  if (!payload || typeof payload !== "object") {
    throw new Error("Failed to decode Cognito token payload");
  }

  return payload as Record<string, unknown>;
}

/**
 * Authenticates directly against Cognito and normalizes the token payload the
 * frontend needs to cache locally.
 */
export async function loginWithCognito(
  command: LoginCommand,
): Promise<CognitoLoginResult> {
  if (!isCognitoConfigured()) {
    throw new Error("Cognito is not configured in the backend environment");
  }

  const client = getCognitoIdentityProviderClient();
  const { clientId } = getCognitoConfig();
  const response = await client.send(
    new AdminInitiateAuthCommand({
      UserPoolId: getCognitoConfig().userPoolId,
      ClientId: clientId,
      AuthFlow: "ADMIN_USER_PASSWORD_AUTH",
      AuthParameters: {
        USERNAME: command.username,
        PASSWORD: command.password,
      },
    }),
  );

  const accessToken = response.AuthenticationResult?.AccessToken;
  const idToken = response.AuthenticationResult?.IdToken ?? null;
  const refreshToken = response.AuthenticationResult?.RefreshToken ?? null;

  if (!accessToken) {
    throw new Error("Cognito did not return an access token");
  }

  const idPayload = idToken ? decodeTokenPayload(idToken) : {};
  const sub = typeof idPayload.sub === "string" ? idPayload.sub : null;
  const account = sub ? await findAccountByCognitoSub(sub) : null;

  return {
    provider: "cognito",
    account: account ? await mapAccountRowToPublicAccount(account) : null,
    accessToken,
    idToken,
    refreshToken,
  };
}

/**
 * Exchanges a Cognito refresh token for a fresh access/id token pair.
 */
export async function refreshWithCognito(
  command: RefreshCognitoCommand,
  dependencies: RefreshWithCognitoDependencies = refreshWithCognitoDependencies,
): Promise<CognitoRefreshResult> {
  if (!dependencies.isCognitoConfigured()) {
    throw new Error("Cognito is not configured in the backend environment");
  }

  const client = dependencies.getCognitoIdentityProviderClient();
  const { clientId } = dependencies.getCognitoConfig();
  const response = await client.send(
    new InitiateAuthCommand({
      ClientId: clientId,
      AuthFlow: "REFRESH_TOKEN_AUTH",
      AuthParameters: {
        REFRESH_TOKEN: command.refreshToken,
      },
    }),
  );

  const accessToken = response.AuthenticationResult?.AccessToken;
  const idToken = response.AuthenticationResult?.IdToken ?? null;

  if (!accessToken) {
    throw new Error("Cognito did not return an access token");
  }

  return {
    provider: "cognito",
    accessToken,
    idToken,
    refreshToken: response.AuthenticationResult?.RefreshToken ?? command.refreshToken,
    expiresIn: response.AuthenticationResult?.ExpiresIn ?? null,
    tokenType: response.AuthenticationResult?.TokenType ?? null,
  };
}

/**
 * Starts the Cognito sign-up flow and mirrors the account into the local
 * application database.
 */
export async function registerWithCognito(
  command: RegisterCommand,
): Promise<CognitoRegisterResult> {
  if (!isCognitoConfigured()) {
    throw new Error("Cognito is not configured in the backend environment");
  }

  const existingByUsername = await findAccountByUsername(command.username);

  if (existingByUsername) {
    throw new UsernameAlreadyExistsError();
  }

  const client = getCognitoIdentityProviderClient();
  const { clientId } = getCognitoConfig();
  const normalizedEmail = command.email.trim().toLowerCase();
  const normalizedUsername = command.username.trim();
  const response = await client.send(
    new SignUpCommand({
      ClientId: clientId,
      Username: normalizedUsername,
      Password: command.password,
      UserAttributes: [
        {
          Name: "email",
          Value: normalizedEmail,
        },
        {
          Name: "preferred_username",
          Value: normalizedUsername,
        },
      ],
    }),
  );

  const userSub = response.UserSub;

  if (!userSub) {
    throw new Error("Cognito did not return a user sub");
  }

  const input: CreateAccountInput = {
    orgId: command.orgId,
    email: normalizedEmail,
    username: normalizedUsername,
    authProvider: "cognito",
    cognitoSub: userSub,
    passwordHash: null,
    roleId: command.roleId ?? null,
  };

  const account = await createAccount(input);

  return {
    provider: "cognito",
    account: await mapAccountRowToPublicAccount(account),
    userSub,
    userConfirmed: Boolean(response.UserConfirmed),
  };
}

/**
 * Verifies the caller's Cognito access token against the configured user pool.
 */
export async function verifyWithCognito(
  command: VerifyCognitoCommand,
  dependencies: VerifyWithCognitoDependencies = verifyWithCognitoDependencies,
): Promise<CognitoVerifyResult> {
  if (!dependencies.isCognitoConfigured()) {
    throw new Error("Cognito is not configured in the backend environment");
  }

  const claims = await dependencies.verifyCognitoAccessToken(command.accessToken);
  const account = await dependencies.findAccountByCognitoSub(claims.sub);
  const responseClaims: CognitoVerifyResult["claims"] = {
    sub: claims.sub,
    tokenUse: claims.token_use,
  };

  if (typeof claims.email === "string") {
    responseClaims.email = claims.email;
  }

  if (typeof claims.username === "string") {
    responseClaims.username = claims.username;
  }

  if (typeof claims["cognito:username"] === "string") {
    responseClaims.cognitoUsername = claims["cognito:username"];
  }

  return {
    provider: "cognito",
    verified: true,
    account: account ? await mapAccountRowToPublicAccount(account) : null,
    claims: responseClaims,
  };
}

function buildDefaultOrganizationName(username: string): string {
  const trimmed = username.trim();
  return trimmed.length > 0 ? `${trimmed}'s Organization` : "My Organization";
}

async function ensureOwnerRoleInTransaction(
  client: TransactionClientLike,
  dependencies: ResolveCognitoSessionDependencies,
  organizationId: string,
  roleName: string,
): Promise<{ id: string }> {
  const existingRole = await dependencies.findRoleByNameInTransaction(
    client,
    organizationId,
    roleName,
  );

  if (existingRole) {
    return existingRole;
  }

  const createdRole = await dependencies.createRoleInTransaction(
    client,
    organizationId,
    roleName,
    OWNER_ROLE_LEVEL,
  );

  await dependencies.assignRolePermissionsInTransaction(
    client,
    createdRole.id,
    OWNER_ROLE_PERMISSIONS,
  );

  return createdRole;
}

async function ensureMemberRoleInTransaction(
  client: TransactionClientLike,
  dependencies: ResolveCognitoSessionDependencies,
  organizationId: string,
): Promise<{ id: string }> {
  const existingRole = await dependencies.findRoleByNameInTransaction(
    client,
    organizationId,
    MEMBER_ROLE_NAME,
  );

  if (existingRole) {
    return existingRole;
  }

  const createdRole = await dependencies.createRoleInTransaction(
    client,
    organizationId,
    MEMBER_ROLE_NAME,
    MEMBER_ROLE_LEVEL,
  );

  await dependencies.assignRolePermissionsInTransaction(
    client,
    createdRole.id,
    MEMBER_ROLE_PERMISSIONS,
  );

  return createdRole;
}

function parseBooleanEnvironmentFlag(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}

function getDemoDefaultOrganizationConfig(): DemoDefaultOrganizationConfig {
  return {
    enabled: parseBooleanEnvironmentFlag(process.env.DEMO_DEFAULT_ORG_ENABLED),
    organizationName:
      process.env.DEMO_DEFAULT_ORG_NAME?.trim() || "Developer Workspace",
    roleName: process.env.DEMO_DEFAULT_ROLE_NAME?.trim() || "Developer",
  };
}

function mapResolveClaims(
  claims: Awaited<ReturnType<typeof verifyCognitoAccessToken>>,
): CognitoResolveResult["claims"] {
  const responseClaims: CognitoResolveResult["claims"] = {
    sub: claims.sub,
    tokenUse: claims.token_use,
  };

  if (typeof claims.email === "string") {
    responseClaims.email = claims.email;
  }

  if (typeof claims.username === "string") {
    responseClaims.username = claims.username;
  }

  if (typeof claims["cognito:username"] === "string") {
    responseClaims.cognitoUsername = claims["cognito:username"];
  }

  return responseClaims;
}

/**
 * Resolves a Cognito session into a provisioned local account and organization
 * membership, creating the surrounding org/roles on first login.
 */
export async function resolveCognitoSession(
  command: ResolveCognitoSessionCommand,
  dependencies: ResolveCognitoSessionDependencies = resolveCognitoSessionDependencies,
): Promise<CognitoResolveResult> {
  if (!dependencies.isCognitoConfigured()) {
    throw new Error("Cognito is not configured in the backend environment");
  }

  const accessClaims = await dependencies.verifyCognitoAccessToken(
    command.accessToken,
  );
  const idClaims = await dependencies.verifyCognitoIdToken(command.idToken);

  if (accessClaims.sub !== idClaims.sub) {
    throw new Error("Cognito access and ID token subjects do not match");
  }

  const existingAccount = await dependencies.findAccountByCognitoSub(
    accessClaims.sub,
  );

  if (existingAccount) {
    return {
      provider: "cognito",
      verified: true,
      provisioned: false,
      account: await mapAccountRowToPublicAccount(existingAccount),
      claims: mapResolveClaims(accessClaims),
    };
  }

  const username =
    (typeof idClaims["cognito:username"] === "string" &&
      idClaims["cognito:username"].trim()) ||
    (typeof idClaims.username === "string" && idClaims.username.trim()) ||
    "";
  const email =
    typeof idClaims.email === "string" ? idClaims.email.trim().toLowerCase() : "";

  if (!username) {
    throw new Error("Cognito ID token did not include a username claim");
  }

  if (!email) {
    throw new Error("Cognito ID token did not include an email claim");
  }

  const client = await dependencies.getTransactionalClient();

  try {
    await client.query("BEGIN");

    const normalizedJoinKey = normalizeOrganizationJoinKey(command.joinKey);
    const demoDefaultOrganizationConfig =
      dependencies.getDemoDefaultOrganizationConfig();
    const invitedOrganization =
      isOrganizationJoinKeyValid(normalizedJoinKey)
        ? await dependencies.findOrganizationByJoinKeyInTransaction(
            client,
            normalizedJoinKey,
          )
        : null;

    const organization = invitedOrganization
      ?? (demoDefaultOrganizationConfig.enabled
        ? (await dependencies.findOrganizationByNameInTransaction(
            client,
            demoDefaultOrganizationConfig.organizationName,
          )) ??
          (await createOrganizationWithGeneratedJoinKeyInTransaction(
            client,
            demoDefaultOrganizationConfig.organizationName,
            dependencies.createOrganizationInTransaction,
          ))
        : await createOrganizationWithGeneratedJoinKeyInTransaction(
            client,
            buildDefaultOrganizationName(username),
            dependencies.createOrganizationInTransaction,
          ));

    const role = invitedOrganization
      ? (await dependencies.findLowestNonOwnerRoleInTransaction(
          client,
          organization.id,
        )) ?? (await ensureMemberRoleInTransaction(client, dependencies, organization.id))
      : await ensureOwnerRoleInTransaction(
          client,
          dependencies,
          organization.id,
          demoDefaultOrganizationConfig.enabled
            ? demoDefaultOrganizationConfig.roleName
            : OWNER_ROLE_NAME,
        );

    if (!invitedOrganization) {
      await ensureMemberRoleInTransaction(client, dependencies, organization.id);
    }

    const account = await dependencies.createAccountInTransaction(client, {
      orgId: organization.id,
      email,
      username,
      authProvider: "cognito",
      cognitoSub: accessClaims.sub,
      passwordHash: null,
      roleId: role.id,
    });

    await client.query("COMMIT");

    return {
      provider: "cognito",
      verified: true,
      provisioned: true,
      account: await mapAccountRowToPublicAccount(account),
      claims: mapResolveClaims(accessClaims),
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Exposes whether Cognito is configured so the client can choose the right auth
 * experience without guessing from environment state.
 */
export async function getCognitoStatus(): Promise<CognitoAuthResult> {
  return {
    provider: "cognito",
    configured: isCognitoConfigured(),
    message:
      "Cognito is configured for client-side login with backend JWT verification.",
  };
}

type BackendTokenClaims = {
  sub: string;
  provider: "backend";
};

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();

  if (!secret) {
    throw new Error("Missing JWT_SECRET in backend environment");
  }

  return secret;
}

function signBackendAccessToken(account: AuthAccountRow): string {
  return sign(
    {
      sub: account.id,
      provider: "backend",
    } satisfies BackendTokenClaims,
    getJwtSecret(),
    { expiresIn: "1h" },
  );
}

/**
 * Verifies a backend-issued JWT and maps it back into the public account shape
 * consumed by auth middleware.
 */
export async function verifyBackendAccessToken(
  token: string,
): Promise<PublicAuthAccount | null> {
  const payload = verify(token, getJwtSecret());

  if (!payload || typeof payload !== "object") {
    return null;
  }

  const claims = payload as Partial<BackendTokenClaims>;

  if (claims.provider !== "backend" || typeof claims.sub !== "string") {
    return null;
  }

  const account = await findAccountById(claims.sub);

  if (account?.auth_provider !== "backend") {
    return null;
  }

  return mapAccountRowToPublicAccount(account);
}

/**
 * Returns all accounts in public form for admin/debug surfaces.
 */
export async function listAccounts(): Promise<PublicAuthAccount[]> {
  const accounts = await getAllAccounts();
  return Promise.all(accounts.map(mapAccountRowToPublicAccount));
}

/**
 * Deletes the current account while enforcing organization lifecycle rules:
 * sole-member orgs are removed, multi-member owners are blocked, and members
 * are detached cleanly before deletion.
 */
export async function deleteMyAccount(
  accountId: string,
  dependencies: DeleteMyAccountDependencies = deleteMyAccountDependencies,
): Promise<DeleteMyAccountResult> {
  const account = await dependencies.findAccountById(accountId);

  if (!account) {
    throw new AccountNotFoundError();
  }

  const members = await dependencies.listOrganizationMembers(account.org_id);
  const isOnlyMember = members.length === 1;

  if (!isOnlyMember && account.role_id) {
    const role = await dependencies.findRoleById(account.role_id);

    if ((role?.level ?? 0) >= OWNER_ROLE_LEVEL) {
      throw new AccountDeletionBlockedError(
        "Owners must delete the organization before deleting their account",
      );
    }
  }

  const client = await dependencies.getTransactionalClient();

  try {
    await client.query("BEGIN");

    await dependencies.clearAccountRoleInTransaction(client, accountId);
    const deletedAccount = await dependencies.deleteAccountInTransaction(client, accountId);

    if (!deletedAccount) {
      throw new AccountNotFoundError();
    }

    let deletedOrganizationId: string | null = null;

    if (isOnlyMember) {
      try {
        const deletedOrganization = await dependencies.deleteOrganizationInTransaction(
          client,
          account.org_id,
        );

        deletedOrganizationId = deletedOrganization?.id ?? account.org_id;
      } catch (error) {
        if (
          error instanceof Error
          && "code" in error
          && (error as { code?: string }).code === "23503"
        ) {
          throw new AccountDeletionBlockedError(
            "Delete the organization and its data before deleting the final account",
          );
        }

        throw error;
      }
    }

    await client.query("COMMIT");

    return {
      deletedAccountId: deletedAccount.id,
      deletedOrganizationId,
      organizationDeleted: isOnlyMember,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
