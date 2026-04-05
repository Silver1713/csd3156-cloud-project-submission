import test from "node:test";
import assert from "node:assert/strict";

import { getAssignablePermissionCatalog } from "../../auth/services/authorization.service.js";
import {
  createOrganizationRoleForAccount,
  createOrganizationForAccount,
  deleteOrganizationForAccount,
  getCurrentOrganizationForAccount,
  getOrganizationMemberCountForAccount,
  getOrganizationPermissionCatalogForAccount,
  listOrganizationRolesForAccount,
  removeOrganizationMemberForAccount,
  updateOrganizationMemberForAccount,
  updateOrganizationForAccount,
} from "../services/organizations.service.js";
import type { OrganizationAccessContext } from "../types/organizations.account.types.js";
import {
  OrganizationDeleteBlockedError,
  OrganizationPermissionDeniedError,
} from "../types/organizations.errors.types.js";

const currentAccount = {
  id: "account-1",
  orgId: "org-1",
  profileUrl: null,
  name: "Owner User",
  email: "owner@example.com",
  username: "owner_user",
  authProvider: "cognito" as const,
  cognitoSub: "sub-123",
  roleId: "role-1",
};

const accessContext: OrganizationAccessContext = {
  accountId: currentAccount.id,
  organization: {
    id: "org-1",
    name: "Current Org",
    joinKey: "ORG10001",
    criticalStockThreshold: 10,
    lowStockThreshold: 25,
    capabilities: {
      canDeleteOrganization: true,
      canRegenerateJoinKey: true,
      canViewJoinKey: true,
    },
  },
  role: {
    id: "role-1",
    orgId: "org-1",
    name: "owner",
    level: 255,
    createdAt: "",
    permissions: ["organization:manage", "organization:update"],
  },
};

const noUpdatePermissionAccessContext: OrganizationAccessContext = {
  ...accessContext,
  role: {
    id: "role-1",
    orgId: "org-1",
    name: "owner",
    level: 255,
    createdAt: "",
    permissions: [],
  },
};

const memberRows = [
  {
    account_id: "account-1",
    org_id: "org-1",
    email: "owner@example.com",
    username: "owner_user",
    name: "Owner",
    profile_url: null,
    profile_object_key: null,
    auth_provider: "cognito",
    cognito_sub: "sub-123",
    role_id: "role-1",
    role_name: "owner",
    created_at: new Date("2026-03-28T00:00:00.000Z"),
    updated_at: new Date("2026-03-28T00:00:00.000Z"),
  },
  {
    account_id: "account-2",
    org_id: "org-1",
    email: "member@example.com",
    username: "member_user",
    name: "Member",
    profile_url: null,
    profile_object_key: null,
    auth_provider: "backend",
    cognito_sub: null,
    role_id: "role-2",
    role_name: "member",
    created_at: new Date("2026-03-28T00:00:00.000Z"),
    updated_at: new Date("2026-03-28T00:00:00.000Z"),
  },
];

function createDeps(overrides: Record<string, unknown> = {}) {
  return {
    createOrganization: async (name: string) => ({
      id: "org-new",
      name,
      join_key: "NEW10001",
      critical_stock_threshold: 10,
      low_stock_threshold: 25,
    }),
    getTransactionalClient: async () => ({
      query: async () => undefined,
      release: () => undefined,
    }),
    createOrganizationInTransaction: async (
      _client: unknown,
      name: string,
      joinKey: string,
    ) => ({
      id: "org-new",
      name,
      join_key: joinKey,
      critical_stock_threshold: 10,
      low_stock_threshold: 25,
    }),
    createRoleInTransaction: async (
      _client: unknown,
      orgId: string,
      name: string,
      _level: number,
    ) => ({
      id: "role-owner",
      org_id: orgId,
      name,
      level: 255,
      created_at: new Date("2026-03-28T00:00:00.000Z"),
    }),
    assignRolePermissionsInTransaction: async () => undefined,
    updateAccountOrganizationInTransaction: async (
      _client: unknown,
      accountId: string,
      orgId: string,
      roleId: string | null,
    ) => ({
      id: accountId,
      org_id: orgId,
      profile_url: null,
      profile_object_key: null,
      name: currentAccount.name,
      email: currentAccount.email,
      username: currentAccount.username,
      auth_provider: currentAccount.authProvider,
      cognito_sub: currentAccount.cognitoSub,
      role_id: roleId,
    }),
    findOrganizationById: async () => ({
      id: "org-1",
      name: "Current Org",
      join_key: "ORG10001",
      critical_stock_threshold: 10,
      low_stock_threshold: 25,
    }),
    findRoleById: async (roleId: string) => ({
      id: roleId,
      org_id: "org-1",
      name: roleId === "role-1" ? "owner" : "member",
      level: roleId === "role-1" ? 255 : 20,
      created_at: new Date("2026-03-28T00:00:00.000Z"),
    }),
    findOrganizationAccessContextByAccountId: async () => ({
      account_id: currentAccount.id,
      org_id: "org-1",
      org_name: "Current Org",
      org_join_key: "ORG10001",
      org_critical_stock_threshold: 10,
      org_low_stock_threshold: 25,
      role_id: "role-1",
      role_name: "owner",
      role_level: 255,
    }),
    listRolePermissions: async () => [
      { role_id: "role-1", permission: "organization:manage" },
      { role_id: "role-1", permission: "organization:update" },
    ],
    listOrganizationRoles: async () => [
      {
        id: "role-1",
        org_id: "org-1",
        name: "owner",
        level: 255,
        created_at: new Date("2026-03-28T00:00:00.000Z"),
      },
      {
        id: "role-2",
        org_id: "org-1",
        name: "member",
        level: 20,
        created_at: new Date("2026-03-28T00:00:00.000Z"),
      },
    ],
    listOrganizationMembers: async () => memberRows,
    updateOrganization: async (
      orgId: string,
      input: {
        name: string;
        criticalStockThreshold: number;
        lowStockThreshold: number;
      },
    ) => ({
      id: orgId,
      name: input.name,
      join_key: "ORG10001",
      critical_stock_threshold: input.criticalStockThreshold,
      low_stock_threshold: input.lowStockThreshold,
    }),
    updateOrganizationJoinKey: async (orgId: string, joinKey: string) => ({
      id: orgId,
      name: "Current Org",
      join_key: joinKey,
      critical_stock_threshold: 10,
      low_stock_threshold: 25,
    }),
    deleteOrganization: async (orgId: string) => ({
      id: orgId,
      name: "Deleted Org",
      join_key: "DEL10001",
      critical_stock_threshold: 10,
      low_stock_threshold: 25,
    }),
    updateUserInOrganization: async (
      userId: string,
      orgId: string,
      input: { roleId?: string | null | undefined },
    ) => ({
      ...sampleUpdatedUser(userId, orgId),
      role_id: input.roleId ?? null,
    }),
    getBasePermissions: () => ["organization:create", "auth:delete_self"] as const,
    getPermissionCatalog: getAssignablePermissionCatalog,
    ...overrides,
  };
}

function sampleUpdatedUser(userId: string, orgId: string) {
  return {
    id: userId,
    org_id: orgId,
    profile_url: null,
    profile_object_key: null,
    name: "Updated Member",
    email: "member@example.com",
    username: "member_user",
    auth_provider: "cognito",
    cognito_sub: "sub-999",
    role_id: "role-2",
    created_at: new Date("2026-03-28T00:00:00.000Z"),
    updated_at: new Date("2026-03-28T00:00:00.000Z"),
  };
}

test("getOrganizationMemberCountForAccount returns current org member count", async () => {
  const result = await getOrganizationMemberCountForAccount(
    currentAccount.id,
    createDeps(),
  );

  assert.equal(result.organization.id, "org-1");
  assert.equal(result.organization.joinKey, "ORG10001");
  assert.equal(result.organization.criticalStockThreshold, 10);
  assert.equal(result.organization.lowStockThreshold, 25);
  assert.equal(result.memberCount, 2);
});

test("getCurrentOrganizationForAccount returns the resolved current organization", async () => {
  const result = await getCurrentOrganizationForAccount(
    currentAccount.id,
    createDeps(),
  );

  assert.equal(result.organization.id, "org-1");
  assert.equal(result.organization.name, "Current Org");
  assert.equal(result.organization.joinKey, "ORG10001");
  assert.equal(result.organization.criticalStockThreshold, 10);
  assert.equal(result.organization.lowStockThreshold, 25);
});

test("getCurrentOrganizationForAccount hides the join key when the current role lacks invite permissions", async () => {
  const result = await getCurrentOrganizationForAccount(
    currentAccount.id,
    createDeps({
      listRolePermissions: async () => [{ role_id: "role-1", permission: "organization:read" }],
    }),
  );

  assert.equal(result.organization.id, "org-1");
  assert.equal(result.organization.joinKey, null);
});

test("listOrganizationRolesForAccount returns roles with permissions", async () => {
  const result = await listOrganizationRolesForAccount(
    currentAccount.id,
    createDeps({
      listRolePermissions: async (roleId: string) =>
        roleId === "role-1"
          ? [{ role_id: "role-1", permission: "organization:manage" }]
          : [{ role_id: "role-2", permission: "organization:members:read" }],
    }),
  );

  assert.equal(result.roles.length, 2);
  const rolesByName = new Map(result.roles.map((role) => [role.name, role]));
  assert.ok(rolesByName.has("member"));
  assert.deepEqual(rolesByName.get("owner")?.permissions, ["organization:manage"]);
});

test("getOrganizationPermissionCatalogForAccount returns the permission catalog", async () => {
  const result = await getOrganizationPermissionCatalogForAccount(
    currentAccount.id,
    createDeps(),
  );

  assert.ok(result.permissions.length > 2);
  assert.equal(result.permissionMap["organization:read"], 101);
  assert.equal(result.permissionMap["organization:create"], undefined);
  assert.equal(result.permissionMap["auth:delete_self"], undefined);
  assert.equal(result.permissionMap["auth:delete"], undefined);
});

test("createOrganizationForAccount rejects when base organization:create permission is missing", async () => {
  await assert.rejects(
    () =>
      createOrganizationForAccount(
        currentAccount,
        { name: "New Org" },
        createDeps({
          getBasePermissions: () => ["auth:delete_self"] as const,
        }),
      ),
    OrganizationPermissionDeniedError,
  );
});

test("createOrganizationForAccount provisions organization, owner role, and account switch in one transaction", async () => {
  const executedQueries: string[] = [];
  const assignedPermissions = new Map<string, readonly string[]>();
  let switchedOrgId: string | null = null;
  let switchedRoleId: string | null = null;

  const result = await createOrganizationForAccount(
    currentAccount,
    { name: "  New Org  " },
    createDeps({
      getTransactionalClient: async () => ({
        query: async (text: string) => {
          executedQueries.push(text);
          return undefined;
        },
        release: () => undefined,
      }),
      createOrganizationInTransaction: async (
        _client: unknown,
        name: string,
        joinKey: string,
      ) => ({
        id: "org-new",
        name,
        join_key: joinKey,
        critical_stock_threshold: 10,
        low_stock_threshold: 25,
      }),
      createRoleInTransaction: async (
        _client: unknown,
        orgId: string,
        name: string,
        level: number,
      ) => ({
        id: name === "owner" ? "role-owner" : "role-member",
        org_id: orgId,
        name,
        level,
        created_at: new Date("2026-03-28T00:00:00.000Z"),
      }),
      assignRolePermissionsInTransaction: async (
        _client: unknown,
        roleId: string,
        permissions: readonly string[],
      ) => {
        assignedPermissions.set(roleId, permissions);
      },
      updateAccountOrganizationInTransaction: async (
        _client: unknown,
        accountId: string,
        orgId: string,
        roleId: string | null,
      ) => {
        assert.equal(accountId, currentAccount.id);
        switchedOrgId = orgId;
        switchedRoleId = roleId;
        return {
          id: accountId,
          org_id: orgId,
          profile_url: null,
          profile_object_key: null,
          name: currentAccount.name,
          email: currentAccount.email,
          username: currentAccount.username,
          auth_provider: currentAccount.authProvider,
          cognito_sub: currentAccount.cognitoSub,
          role_id: roleId,
        };
      },
    }),
  );

  assert.equal(result.organization.id, "org-new");
  assert.equal(result.organization.name, "New Org");
  assert.ok(result.organization.joinKey);
  assert.match(result.organization.joinKey, /^[A-Z0-9]{8}$/);
  assert.equal(result.organization.criticalStockThreshold, 10);
  assert.equal(result.organization.lowStockThreshold, 25);
  assert.equal(switchedOrgId, "org-new");
  assert.equal(switchedRoleId, "role-owner");
  assert.ok((assignedPermissions.get("role-owner")?.length ?? 0) > 0);
  assert.ok((assignedPermissions.get("role-member")?.length ?? 0) > 0);
  assert.deepEqual(executedQueries, ["BEGIN", "COMMIT"]);
});

test("updateOrganizationForAccount rejects when current role lacks organization update permissions", async () => {
  await assert.rejects(
    () =>
      updateOrganizationForAccount(
        currentAccount,
        {
          organizationId: "org-1",
          name: "Renamed Org",
        },
        noUpdatePermissionAccessContext,
        createDeps(),
      ),
    OrganizationPermissionDeniedError,
  );
});

test("createOrganizationRoleForAccount requires organization manage permission", async () => {
  await assert.rejects(
    () =>
      createOrganizationRoleForAccount(
        currentAccount,
        {
          name: "auditor",
          level: 40,
          permissions: ["organization:members:read"],
        },
        noUpdatePermissionAccessContext,
        createDeps(),
      ),
    OrganizationPermissionDeniedError,
  );
});

test("createOrganizationRoleForAccount creates role with permissions in the current organization", async () => {
  let assignedPermissions: readonly string[] = [];

  const result = await createOrganizationRoleForAccount(
    currentAccount,
    {
      name: "auditor",
      level: 40,
      permissions: ["organization:members:read", "inventory:read"],
    },
    accessContext,
    createDeps({
      createRoleInTransaction: async (
        _client: unknown,
        _orgId: string,
        _name: string,
        level: number,
      ) => ({
        id: "role-auditor",
        org_id: "org-1",
        name: "auditor",
        level,
        created_at: new Date("2026-03-29T00:00:00.000Z"),
      }),
      assignRolePermissionsInTransaction: async (
        _client: unknown,
        _roleId: string,
        permissions: readonly string[],
      ) => {
        assignedPermissions = permissions;
      },
    }),
  );

  assert.equal(result.role.id, "role-auditor");
  assert.deepEqual(assignedPermissions, [
    "organization:members:read",
    "inventory:read",
  ]);
});

test("updateOrganizationMemberForAccount updates the member role inside the current organization", async () => {
  const result = await updateOrganizationMemberForAccount(
    currentAccount,
    {
      accountId: "account-2",
      roleId: "role-2",
    },
    accessContext,
    createDeps(),
  );

  assert.equal(result.member.accountId, "account-2");
  assert.equal(result.member.roleId, "role-2");
  assert.equal(result.member.roleName, "member");
});

test("updateOrganizationForAccount updates organization thresholds", async () => {
  const result = await updateOrganizationForAccount(
    currentAccount,
    {
      organizationId: "org-1",
      criticalStockThreshold: 5,
      lowStockThreshold: 15,
    },
    accessContext,
    createDeps(),
  );

  assert.equal(result.organization.id, "org-1");
  assert.equal(result.organization.name, "Current Org");
  assert.equal(result.organization.joinKey, "ORG10001");
  assert.equal(result.organization.criticalStockThreshold, 5);
  assert.equal(result.organization.lowStockThreshold, 15);
});

test("updateOrganizationMemberForAccount rejects roles from another organization", async () => {
  await assert.rejects(
    () =>
      updateOrganizationMemberForAccount(
        currentAccount,
        {
          accountId: "account-2",
          roleId: "role-external",
        },
        accessContext,
        createDeps({
          findRoleById: async (roleId: string) => ({
            id: roleId,
            org_id: "org-2",
            name: "external",
            level: 10,
            created_at: new Date("2026-03-28T00:00:00.000Z"),
          }),
        }),
      ),
    OrganizationPermissionDeniedError,
  );
});

test("createOrganizationRoleForAccount rejects creating a role at or above the current role level", async () => {
  await assert.rejects(
    () =>
      createOrganizationRoleForAccount(
        currentAccount,
        {
          name: "co-owner",
          level: 255,
          permissions: ["organization:members:read"],
        },
        accessContext,
        createDeps(),
      ),
    OrganizationPermissionDeniedError,
  );
});

test("updateOrganizationMemberForAccount rejects assigning a role at or above the current role level", async () => {
  const adminAccessContext: OrganizationAccessContext = {
    ...accessContext,
    role: {
      id: "role-admin",
      orgId: "org-1",
      name: "admin",
      level: 220,
      createdAt: "",
      permissions: ["organization:members:manage"],
    },
  };

  await assert.rejects(
    () =>
      updateOrganizationMemberForAccount(
        currentAccount,
        {
          accountId: "account-2",
          roleId: "role-owner",
        },
        adminAccessContext,
        createDeps({
          findRoleById: async (roleId: string) => ({
            id: roleId,
            org_id: "org-1",
            name: roleId === "role-owner" ? "owner" : "member",
            level: roleId === "role-owner" ? 255 : 20,
            created_at: new Date("2026-03-28T00:00:00.000Z"),
          }),
        }),
      ),
    OrganizationPermissionDeniedError,
  );
});

test("updateOrganizationMemberForAccount rejects changing a member whose current role is at or above the current role level", async () => {
  const adminAccessContext: OrganizationAccessContext = {
    ...accessContext,
    role: {
      id: "role-admin",
      orgId: "org-1",
      name: "admin",
      level: 220,
      createdAt: "",
      permissions: ["organization:members:manage"],
    },
  };

  await assert.rejects(
    () =>
      updateOrganizationMemberForAccount(
        currentAccount,
        {
          accountId: "account-1",
          roleId: "role-2",
        },
        adminAccessContext,
        createDeps(),
      ),
    OrganizationPermissionDeniedError,
  );
});

test("deleteOrganizationForAccount maps foreign-key delete failures to OrganizationDeleteBlockedError", async () => {
  await assert.rejects(
    () =>
      deleteOrganizationForAccount(
        currentAccount,
        {
          organizationId: "org-1",
        },
        accessContext,
        createDeps({
          deleteOrganization: async () => {
            const error = new Error("delete blocked") as Error & { code?: string };
            error.code = "23503";
            throw error;
          },
        }),
      ),
    OrganizationDeleteBlockedError,
  );
});

test("removeOrganizationMemberForAccount reprovisions a lower-level member into a new organization", async () => {
  const executedQueries: string[] = [];
  let switchedOrgId: string | null = null;
  let switchedRoleId: string | null = null;

  const result = await removeOrganizationMemberForAccount(
    currentAccount,
    { accountId: "account-2" },
    accessContext,
    createDeps({
      getTransactionalClient: async () => ({
        query: async (text: string) => {
          executedQueries.push(text);
          return undefined;
        },
        release: () => undefined,
      }),
      createOrganizationInTransaction: async (
        _client: unknown,
        name: string,
        joinKey: string,
      ) => ({
        id: "org-reprovisioned",
        name,
        join_key: joinKey,
        critical_stock_threshold: 10,
        low_stock_threshold: 25,
      }),
      createRoleInTransaction: async (
        _client: unknown,
        orgId: string,
        name: string,
        level: number,
      ) => ({
        id: name === "owner" ? "role-owner" : "role-member",
        org_id: orgId,
        name,
        level,
        created_at: new Date("2026-03-28T00:00:00.000Z"),
      }),
      updateAccountOrganizationInTransaction: async (
        _client: unknown,
        accountId: string,
        orgId: string,
        roleId: string | null,
      ) => {
        switchedOrgId = orgId;
        switchedRoleId = roleId;
        return {
          id: accountId,
          org_id: orgId,
          profile_url: null,
          profile_object_key: null,
          name: "Member",
          email: "member@example.com",
          username: "member_user",
          auth_provider: "backend",
          cognito_sub: null,
          password_hash: null,
          role_id: roleId,
          created_at: new Date("2026-03-28T00:00:00.000Z"),
          updated_at: new Date("2026-03-28T00:00:00.000Z"),
        };
      },
    }),
  );

  assert.equal(result.removedAccountId, "account-2");
  assert.equal(result.removedFromOrganizationId, "org-1");
  assert.equal(result.selfRemoved, false);
  assert.equal(result.account.orgId, "org-reprovisioned");
  assert.equal(result.account.roleId, "role-owner");
  assert.equal(result.organization.id, "org-reprovisioned");
  assert.equal(switchedOrgId, "org-reprovisioned");
  assert.equal(switchedRoleId, "role-owner");
  assert.deepEqual(executedQueries, ["BEGIN", "COMMIT"]);
});

test("removeOrganizationMemberForAccount rejects self-leave for the owner role", async () => {
  await assert.rejects(
    () =>
      removeOrganizationMemberForAccount(
        currentAccount,
        { accountId: "account-1" },
        accessContext,
        createDeps(),
      ),
    OrganizationPermissionDeniedError,
  );
});
