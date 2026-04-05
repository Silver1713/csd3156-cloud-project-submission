import test from "node:test";
import assert from "node:assert/strict";

import {
  deleteMyAccount,
  refreshWithCognito,
  resolveCognitoSession,
  verifyWithCognito,
} from "../services/auth.service.js";
import type { CreateAccountInput } from "../types/auth.command.types.js";
import type { AuthAccountRow } from "../types/auth.db.types.js";
import { AccountDeletionBlockedError } from "../types/auth.errors.types.js";

const linkedAccount: AuthAccountRow = {
  id: "account-1",
  org_id: "org-1",
  profile_url: null,
  profile_object_key: null,
  name: "Silver User",
  email: "user@example.com",
  username: "silver1713",
  auth_provider: "cognito",
  cognito_sub: "sub-123",
  password_hash: null,
  role_id: "role-1",
  created_at: new Date("2026-03-28T00:00:00.000Z"),
  updated_at: new Date("2026-03-28T00:00:00.000Z"),
};

const accessClaims = {
  sub: "sub-123",
  token_use: "access" as const,
  username: "silver1713",
};

const idClaims = {
  sub: "sub-123",
  token_use: "id" as const,
  email: "user@example.com",
  "cognito:username": "silver1713",
};

function createResolveDependencies(
  overrides: Record<string, unknown> = {},
) {
  return {
    isCognitoConfigured: () => true,
    getDemoDefaultOrganizationConfig: () => ({
      enabled: false,
      organizationName: "Developer Workspace",
      roleName: "Developer",
    }),
    verifyCognitoAccessToken: async () => accessClaims,
    verifyCognitoIdToken: async () => idClaims,
    findAccountByCognitoSub: async () => null,
    getTransactionalClient: async () => ({
      query: async () => ({ rows: [] }),
      release: () => undefined,
    }),
    findOrganizationByNameInTransaction: async () => null,
    findOrganizationByJoinKeyInTransaction: async () => null,
    findRoleByNameInTransaction: async () => null,
    findLowestNonOwnerRoleInTransaction: async () => null,
    createOrganizationInTransaction: async (_client: unknown, name: string) => ({
      id: "org-new",
      name,
      join_key: "JOIN1001",
      critical_stock_threshold: 10,
      low_stock_threshold: 25,
    }),
    createRoleInTransaction: async (
      _client: unknown,
      _orgId: string,
      roleName: string,
    ) => ({
      id: roleName === "owner" || roleName === "Developer" ? "role-owner" : "role-member",
    }),
    assignRolePermissionsInTransaction: async () => undefined,
    createAccountInTransaction: async (_client: unknown, input: CreateAccountInput) => ({
      ...linkedAccount,
      id: "account-new",
      org_id: input.orgId,
      email: input.email,
      username: input.username,
      cognito_sub: input.cognitoSub,
      role_id: input.roleId,
    }),
    ...overrides,
  };
}

test("verifyWithCognito returns claims and linked account using mocked dependencies", async () => {
  let verifiedToken: string | null = null;

  const result = await verifyWithCognito(
    { accessToken: "access-token" },
    {
      isCognitoConfigured: () => true,
      verifyCognitoAccessToken: async (token) => {
        verifiedToken = token;
        return accessClaims;
      },
      findAccountByCognitoSub: async (sub) => {
        assert.equal(sub, "sub-123");
        return linkedAccount;
      },
    },
  );

  assert.equal(verifiedToken, "access-token");
  assert.equal(result.verified, true);
  assert.equal(result.account?.id, linkedAccount.id);
  assert.equal(result.claims.sub, "sub-123");
  assert.equal(result.claims.username, "silver1713");
});

test("resolveCognitoSession returns existing linked account without provisioning", async () => {
  let transactionRequested = false;

  const result = await resolveCognitoSession(
    {
      accessToken: "access-token",
      idToken: "id-token",
    },
    createResolveDependencies({
      findAccountByCognitoSub: async () => linkedAccount,
      getTransactionalClient: async () => {
        transactionRequested = true;
        return {
          query: async () => ({ rows: [] }),
          release: () => undefined,
        };
      },
    }),
  );

  assert.equal(result.provisioned, false);
  assert.equal(result.account.id, linkedAccount.id);
  assert.equal(transactionRequested, false);
});

test("resolveCognitoSession provisions organization, owner role, member role, and linked account when missing", async () => {
  const executedQueries: string[] = [];
  const createdRoleNames: string[] = [];
  const assignedPermissions = new Map<string, readonly string[]>();
  let createdOrganizationName: string | undefined;
  let createdAccountRoleId: string | null | undefined;

  const result = await resolveCognitoSession(
    {
      accessToken: "access-token",
      idToken: "id-token",
    },
    createResolveDependencies({
      getTransactionalClient: async () => ({
        query: async (text: string) => {
          executedQueries.push(text);
          return { rows: [] };
        },
        release: () => undefined,
      }),
      createOrganizationInTransaction: async (_client: unknown, name: string) => {
        createdOrganizationName = name;
        return {
          id: "org-new",
          name,
          join_key: "JOIN1001",
          critical_stock_threshold: 10,
          low_stock_threshold: 25,
        };
      },
      createRoleInTransaction: async (
        _client: unknown,
        orgId: string,
        roleName: string,
        level: number,
      ) => {
        assert.equal(orgId, "org-new");
        createdRoleNames.push(roleName);
        assert.equal(level, roleName === "owner" ? 255 : 20);
        return { id: roleName === "owner" ? "role-owner" : "role-member" };
      },
      assignRolePermissionsInTransaction: async (
        _client: unknown,
        roleId: string,
        permissions: readonly string[],
      ) => {
        assignedPermissions.set(roleId, permissions);
      },
      createAccountInTransaction: async (_client: unknown, input: CreateAccountInput) => {
        createdAccountRoleId = input.roleId;
        return {
          ...linkedAccount,
          id: "account-new",
          org_id: input.orgId,
          email: input.email,
          username: input.username,
          cognito_sub: input.cognitoSub,
          role_id: input.roleId,
        };
      },
    }),
  );

  assert.equal(result.provisioned, true);
  assert.equal(result.account.id, "account-new");
  assert.equal(createdOrganizationName, "silver1713's Organization");
  assert.deepEqual(createdRoleNames, ["owner", "member"]);
  assert.equal(createdAccountRoleId, "role-owner");
  assert.ok((assignedPermissions.get("role-owner")?.length ?? 0) > 0);
  assert.ok((assignedPermissions.get("role-member")?.length ?? 0) > 0);
  assert.deepEqual(executedQueries, ["BEGIN", "COMMIT"]);
});

test("resolveCognitoSession provisions into shared demo organization when enabled", async () => {
  const createdRoleNames: string[] = [];

  const result = await resolveCognitoSession(
    {
      accessToken: "access-token",
      idToken: "id-token",
    },
    createResolveDependencies({
      getDemoDefaultOrganizationConfig: () => ({
        enabled: true,
        organizationName: "Developer Workspace",
        roleName: "Developer",
      }),
      createOrganizationInTransaction: async (_client: unknown, name: string) => ({
        id: "org-demo",
        name,
        join_key: "DEMO1001",
        critical_stock_threshold: 10,
        low_stock_threshold: 25,
      }),
      createRoleInTransaction: async (
        _client: unknown,
        orgId: string,
        roleName: string,
        level: number,
      ) => {
        assert.equal(orgId, "org-demo");
        createdRoleNames.push(roleName);
        assert.equal(level, roleName === "Developer" ? 255 : 20);
        return { id: roleName === "Developer" ? "role-developer" : "role-member" };
      },
      createAccountInTransaction: async (_client: unknown, input: CreateAccountInput) => ({
        ...linkedAccount,
        id: "account-demo",
        org_id: input.orgId,
        email: input.email,
        username: input.username,
        cognito_sub: input.cognitoSub,
        role_id: input.roleId,
      }),
    }),
  );

  assert.equal(result.provisioned, true);
  assert.equal(result.account.id, "account-demo");
  assert.equal(result.account.orgId, "org-demo");
  assert.equal(result.account.roleId, "role-developer");
  assert.deepEqual(createdRoleNames, ["Developer", "member"]);
});

test("resolveCognitoSession reuses shared demo organization and role when they already exist", async () => {
  let organizationCreated = false;
  let memberRoleCreated = false;

  const result = await resolveCognitoSession(
    {
      accessToken: "access-token",
      idToken: "id-token",
    },
    createResolveDependencies({
      getDemoDefaultOrganizationConfig: () => ({
        enabled: true,
        organizationName: "Developer Workspace",
        roleName: "Developer",
      }),
      findOrganizationByNameInTransaction: async () => ({
        id: "org-demo",
        name: "Developer Workspace",
      }),
      findRoleByNameInTransaction: async (
        _client: unknown,
        _orgId: string,
        roleName: string,
      ) => (roleName === "Developer" ? { id: "role-developer" } : null),
      createOrganizationInTransaction: async () => {
        organizationCreated = true;
        throw new Error("should not create organization");
      },
      createRoleInTransaction: async (
        _client: unknown,
        _orgId: string,
        roleName: string,
      ) => {
        memberRoleCreated = true;
        assert.equal(roleName, "member");
        return { id: "role-member" };
      },
      createAccountInTransaction: async (_client: unknown, input: CreateAccountInput) => ({
        ...linkedAccount,
        id: "account-demo",
        org_id: input.orgId,
        email: input.email,
        username: input.username,
        cognito_sub: input.cognitoSub,
        role_id: input.roleId,
      }),
    }),
  );

  assert.equal(result.provisioned, true);
  assert.equal(result.account.orgId, "org-demo");
  assert.equal(result.account.roleId, "role-developer");
  assert.equal(organizationCreated, false);
  assert.equal(memberRoleCreated, true);
});

test("resolveCognitoSession joins an invited organization when the join key is valid", async () => {
  const result = await resolveCognitoSession(
    {
      accessToken: "access-token",
      idToken: "id-token",
      joinKey: "ATL20001",
    },
    createResolveDependencies({
      findOrganizationByJoinKeyInTransaction: async (_client: unknown, joinKey: string) => {
        assert.equal(joinKey, "ATL20001");
        return { id: "org-invite", name: "Atlas Supplies", join_key: "ATL20001" };
      },
      findLowestNonOwnerRoleInTransaction: async () => ({ id: "role-member" }),
      createOrganizationInTransaction: async () => {
        throw new Error("should not create organization");
      },
      createRoleInTransaction: async () => {
        throw new Error("should not create role");
      },
      createAccountInTransaction: async (_client: unknown, input: CreateAccountInput) => ({
        ...linkedAccount,
        id: "account-invited",
        org_id: input.orgId,
        email: input.email,
        username: input.username,
        cognito_sub: input.cognitoSub,
        role_id: input.roleId,
      }),
    }),
  );

  assert.equal(result.account.orgId, "org-invite");
  assert.equal(result.account.roleId, "role-member");
});

test("resolveCognitoSession provisions a new organization when the join key is invalid", async () => {
  let joinKeyLookupAttempted = false;
  let organizationCreated = false;

  const result = await resolveCognitoSession(
    {
      accessToken: "access-token",
      idToken: "id-token",
      joinKey: "bad-key",
    },
    createResolveDependencies({
      findOrganizationByJoinKeyInTransaction: async () => {
        joinKeyLookupAttempted = true;
        return null;
      },
      createOrganizationInTransaction: async (_client: unknown, name: string) => {
        organizationCreated = true;
        return {
          id: "org-new",
          name,
          join_key: "JOIN1001",
          critical_stock_threshold: 10,
          low_stock_threshold: 25,
        };
      },
    }),
  );

  assert.equal(joinKeyLookupAttempted, false);
  assert.equal(organizationCreated, true);
  assert.equal(result.account.orgId, "org-new");
  assert.equal(result.account.roleId, "role-owner");
});

test("resolveCognitoSession rejects mismatched token subjects", async () => {
  await assert.rejects(
    () =>
      resolveCognitoSession(
        {
          accessToken: "access-token",
          idToken: "id-token",
        },
        createResolveDependencies({
          verifyCognitoIdToken: async () => ({
            ...idClaims,
            sub: "different-sub",
          }),
          createOrganizationInTransaction: async () => {
            throw new Error("should not create organization");
          },
          createRoleInTransaction: async () => {
            throw new Error("should not create role");
          },
          assignRolePermissionsInTransaction: async () => {
            throw new Error("should not assign permissions");
          },
          createAccountInTransaction: async () => {
            throw new Error("should not create account");
          },
        }),
      ),
    /subjects do not match/,
  );
});

test("refreshWithCognito returns refreshed Cognito tokens", async () => {
  const sentInputs: unknown[] = [];

  const result = await refreshWithCognito(
    {
      refreshToken: "refresh-token",
    },
    {
      isCognitoConfigured: () => true,
      getCognitoIdentityProviderClient: () => ({
        send: async (command: unknown) => {
          sentInputs.push(command);
          return {
            AuthenticationResult: {
              AccessToken: "new-access-token",
              IdToken: "new-id-token",
              ExpiresIn: 3600,
              TokenType: "Bearer",
            },
          };
        },
      }) as never,
      getCognitoConfig: () => ({
        region: "us-east-1",
        userPoolId: "us-east-1_pool",
        clientId: "client-id",
      }),
    },
  );

  assert.equal(result.provider, "cognito");
  assert.equal(result.accessToken, "new-access-token");
  assert.equal(result.idToken, "new-id-token");
  assert.equal(result.refreshToken, "refresh-token");
  assert.equal(result.expiresIn, 3600);
  assert.equal(result.tokenType, "Bearer");
  assert.equal(sentInputs.length, 1);
});

test("deleteMyAccount deletes a non-owner account from a multi-member organization", async () => {
  const executedQueries: string[] = [];

  const result = await deleteMyAccount("account-2", {
    getTransactionalClient: async () => ({
      query: async (text: string) => {
        executedQueries.push(text);
        return { rows: [] };
      },
      release: () => undefined,
    }),
    findAccountById: async () => ({
      ...linkedAccount,
      id: "account-2",
      role_id: "role-member",
    }),
    listOrganizationMembers: async () => [
      { account_id: "account-1", role_id: "role-owner" },
      { account_id: "account-2", role_id: "role-member" },
    ],
    findRoleById: async (roleId: string) => ({
      id: roleId,
      level: roleId === "role-owner" ? 255 : 20,
    }),
    clearAccountRoleInTransaction: async () => ({
      ...linkedAccount,
      id: "account-2",
      role_id: null,
    }),
    deleteAccountInTransaction: async () => ({
      ...linkedAccount,
      id: "account-2",
      role_id: null,
    }),
    deleteOrganizationInTransaction: async () => null,
  });

  assert.equal(result.deletedAccountId, "account-2");
  assert.equal(result.deletedOrganizationId, null);
  assert.equal(result.organizationDeleted, false);
  assert.deepEqual(executedQueries, ["BEGIN", "COMMIT"]);
});

test("deleteMyAccount rejects deleting an owner account while other members still exist", async () => {
  await assert.rejects(
    () =>
      deleteMyAccount("account-1", {
        getTransactionalClient: async () => ({
          query: async () => ({ rows: [] }),
          release: () => undefined,
        }),
        findAccountById: async () => linkedAccount,
        listOrganizationMembers: async () => [
          { account_id: "account-1", role_id: "role-owner" },
          { account_id: "account-2", role_id: "role-member" },
        ],
        findRoleById: async () => ({ id: "role-owner", level: 255 }),
        clearAccountRoleInTransaction: async () => linkedAccount,
        deleteAccountInTransaction: async () => linkedAccount,
        deleteOrganizationInTransaction: async () => null,
      }),
    AccountDeletionBlockedError,
  );
});

test("deleteMyAccount deletes the final account and organization together", async () => {
  const executedQueries: string[] = [];

  const result = await deleteMyAccount("account-1", {
    getTransactionalClient: async () => ({
      query: async (text: string) => {
        executedQueries.push(text);
        return { rows: [] };
      },
      release: () => undefined,
    }),
    findAccountById: async () => linkedAccount,
    listOrganizationMembers: async () => [{ account_id: "account-1", role_id: "role-owner" }],
    findRoleById: async () => ({ id: "role-owner", level: 255 }),
    clearAccountRoleInTransaction: async () => ({
      ...linkedAccount,
      role_id: null,
    }),
    deleteAccountInTransaction: async () => ({
      ...linkedAccount,
      role_id: null,
    }),
    deleteOrganizationInTransaction: async () => ({
      id: "org-1",
      name: "Solo Org",
      join_key: "SOLO1001",
      critical_stock_threshold: 10,
      low_stock_threshold: 25,
    }),
  });

  assert.equal(result.deletedAccountId, "account-1");
  assert.equal(result.deletedOrganizationId, "org-1");
  assert.equal(result.organizationDeleted, true);
  assert.deepEqual(executedQueries, ["BEGIN", "COMMIT"]);
});
