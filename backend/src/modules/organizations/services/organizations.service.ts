/**
 * Centralizes organization, role, join-key, and membership lifecycle rules,
 * including hierarchy-aware member management.
 */
import type { Permission } from "../../auth/types/auth.permission.types.js";
import type { PublicAuthAccount } from "../../auth/types/auth.account.types.js";
import {
  getAssignablePermissionCatalog,
  getBasePermissions,
  getPermissionCatalog,
} from "../../auth/services/authorization.service.js";
import { updateAccountOrganizationInTransaction } from "../../auth/repositories/auth.repository.js";
import { pool } from "../../../db/client.js";
import {
  createOrganization as defaultCreateOrganization,
  deleteOrganization as defaultDeleteOrganization,
  findRoleById as defaultFindRoleById,
  findOrganizationAccessContextByAccountId,
  findOrganizationById as defaultFindOrganizationById,
  findOrganizationByJoinKeyInTransaction as defaultFindOrganizationByJoinKeyInTransaction,
  listOrganizationMembers as defaultListOrganizationMembers,
  listOrganizationRoles as defaultListOrganizationRoles,
  listRolePermissions,
  updateOrganization as defaultUpdateOrganization,
  updateOrganizationJoinKey as defaultUpdateOrganizationJoinKey,
  createOrganizationInTransaction as defaultCreateOrganizationInTransaction,
  createRoleInTransaction as defaultCreateRoleInTransaction,
  assignRolePermissionsInTransaction as defaultAssignRolePermissionsInTransaction,
} from "../repositories/organizations.repository.js";
import type {
  OrganizationAccessContext,
  OrganizationAccessContextRow,
  OrganizationMember,
  OrganizationMemberRow,
  OrganizationRolePermissionRow,
  OrganizationRoleRow,
  OrganizationRow,
} from "../types/organizations.types.js";
import {
  OrganizationAccessContextNotFoundError,
  OrganizationDeleteBlockedError,
  OrganizationNotFoundError,
  OrganizationPermissionDeniedError,
} from "../types/organizations.errors.types.js";
import type { AuthenticatedAccountContext } from "../../auth/types/auth.request.types.js";
import type { PoolClient } from "pg";
import { updateUserInOrganization } from "../../users/repositories/users.repository.js";
import type {
  CreateOrganizationCommand,
  CreateOrganizationRoleCommand,
  DeleteOrganizationCommand,
  JoinOrganizationCommand,
  RemoveOrganizationMemberCommand,
  UpdateOrganizationMemberCommand,
  UpdateOrganizationCommand,
} from "../types/organizations.command.types.js";
import {
  OWNER_ROLE_NAME,
  OWNER_ROLE_LEVEL,
  OWNER_ROLE_PERMISSIONS,
  MEMBER_ROLE_NAME,
  MEMBER_ROLE_LEVEL,
  MEMBER_ROLE_PERMISSIONS,
} from "../roles/organization-role-definitions.js";
import {
  createOrganizationWithGeneratedJoinKeyInTransaction,
  generateOrganizationJoinKey,
  isOrganizationJoinKeyValid,
  normalizeOrganizationJoinKey,
} from "../utils/join-key.js";
import { resolveStoredImageUrl } from "../../uploads/services/uploads.service.js";

type TransactionClientLike = {
  query: (text: string) => Promise<unknown>;
  release: () => void;
};

type OrganizationsServiceDependencies = {
  createOrganization: (name: string, joinKey: string) => Promise<OrganizationRow>;
  getTransactionalClient: () => Promise<TransactionClientLike>;
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
  ) => Promise<OrganizationRoleRow>;
  assignRolePermissionsInTransaction: (
    client: TransactionClientLike,
    roleId: string,
    permissions: readonly string[],
  ) => Promise<void>;
  updateAccountOrganizationInTransaction: (
    client: TransactionClientLike,
    accountId: string,
    orgId: string,
    roleId: string | null,
  ) => Promise<{
    id: string;
    org_id: string;
    profile_url: string | null;
    profile_object_key: string | null;
    name: string | null;
    email: string;
    username: string;
    auth_provider: string;
    cognito_sub: string | null;
    role_id: string | null;
  } | null>;
  findOrganizationById: (orgId: string) => Promise<OrganizationRow | null>;
  findOrganizationByJoinKeyInTransaction?: (
    client: TransactionClientLike,
    joinKey: string,
  ) => Promise<OrganizationRow | null>;
  findRoleById: (roleId: string) => Promise<OrganizationRoleRow | null>;
  findOrganizationAccessContextByAccountId: (
    accountId: string,
  ) => Promise<OrganizationAccessContextRow | null>;
  listRolePermissions: (
    roleId: string,
  ) => Promise<OrganizationRolePermissionRow[]>;
  listOrganizationRoles: (orgId: string) => Promise<OrganizationRoleRow[]>;
  listOrganizationMembers: (orgId: string) => Promise<OrganizationMemberRow[]>;
  updateOrganization: (
    orgId: string,
    input: {
      name: string;
      criticalStockThreshold: number;
      lowStockThreshold: number;
    },
  ) => Promise<OrganizationRow | null>;
  updateOrganizationJoinKey: (
    orgId: string,
    joinKey: string,
  ) => Promise<OrganizationRow | null>;
  deleteOrganization: (orgId: string) => Promise<OrganizationRow | null>;
  updateUserInOrganization: (
    userId: string,
    orgId: string,
    input: {
      roleId?: string | null | undefined;
    },
  ) => Promise<{
    id: string;
    org_id: string;
    profile_url: string | null;
    profile_object_key: string | null;
    name: string | null;
    email: string;
    username: string;
    auth_provider: string;
    cognito_sub: string | null;
    role_id: string | null;
    created_at: Date;
    updated_at: Date;
  } | null>;
  getBasePermissions: () => readonly Permission[];
  getPermissionCatalog: typeof getAssignablePermissionCatalog;
};

const defaultDependencies: OrganizationsServiceDependencies = {
  createOrganization: defaultCreateOrganization,
  getTransactionalClient: () => pool.connect(),
  createOrganizationInTransaction: (client, name, joinKey) =>
    defaultCreateOrganizationInTransaction(client as PoolClient, name, joinKey),
  createRoleInTransaction: (client, orgId, name, level) =>
    defaultCreateRoleInTransaction(client as PoolClient, orgId, name, level),
  assignRolePermissionsInTransaction: (client, roleId, permissions) =>
    defaultAssignRolePermissionsInTransaction(
      client as PoolClient,
      roleId,
      permissions,
    ),
  updateAccountOrganizationInTransaction: (client, accountId, orgId, roleId) =>
    updateAccountOrganizationInTransaction(
      client as PoolClient,
      accountId,
      orgId,
      roleId,
    ),
  findOrganizationById: defaultFindOrganizationById,
  findOrganizationByJoinKeyInTransaction: (client, joinKey) =>
    defaultFindOrganizationByJoinKeyInTransaction(client as PoolClient, joinKey),
  findRoleById: defaultFindRoleById,
  findOrganizationAccessContextByAccountId,
  listRolePermissions,
  listOrganizationRoles: defaultListOrganizationRoles,
  listOrganizationMembers: defaultListOrganizationMembers,
  updateOrganization: defaultUpdateOrganization,
  updateOrganizationJoinKey: defaultUpdateOrganizationJoinKey,
  deleteOrganization: defaultDeleteOrganization,
  updateUserInOrganization,
  getBasePermissions,
  getPermissionCatalog: getAssignablePermissionCatalog,
};

/**
 * Loads the caller's organization context, role level, and effective
 * permissions in one normalized object for downstream authorization checks.
 */
export async function getOrganizationAccessContext(
  accountId: string,
  dependencies: OrganizationsServiceDependencies = defaultDependencies,
): Promise<OrganizationAccessContext> {
  const contextRow = await dependencies.findOrganizationAccessContextByAccountId(
    accountId,
  );

  if (!contextRow) {
    throw new OrganizationAccessContextNotFoundError();
  }

  const permissions = contextRow.role_id
    ? await dependencies.listRolePermissions(contextRow.role_id)
    : [];

  return mapAccessContext(contextRow, permissions);
}

/**
 * Returns the current organization's members as viewed by the authenticated
 * account.
 */
export async function listOrganizationMembersForAccount(
  accountId: string,
  dependencies: OrganizationsServiceDependencies = defaultDependencies,
): Promise<OrganizationMember[]> {
  const context = await getOrganizationAccessContext(accountId, dependencies);
  const rows = await dependencies.listOrganizationMembers(context.organization.id);
  return Promise.all(rows.map(mapMemberRow));
}

/**
 * Returns all role definitions for the caller's current organization.
 */
export async function listOrganizationRolesForAccount(
  accountId: string,
  dependencies: OrganizationsServiceDependencies = defaultDependencies,
): Promise<OrganizationRoleWithPermissionsResult> {
  const context = await getOrganizationAccessContext(accountId, dependencies);
  const roleRows = await dependencies.listOrganizationRoles(context.organization.id);
  const roles = await Promise.all(
    roleRows.map(async (roleRow) => {
      const permissions = await dependencies.listRolePermissions(roleRow.id);
      return mapRoleWithPermissions(roleRow, permissions);
    }),
  );

  return { roles };
}

/**
 * Returns the assignable permission catalog for role-management UIs.
 */
export async function getOrganizationPermissionCatalogForAccount(
  accountId: string,
  dependencies: OrganizationsServiceDependencies = defaultDependencies,
): Promise<OrganizationPermissionCatalogResult> {
  await getOrganizationAccessContext(accountId, dependencies);
  return dependencies.getPermissionCatalog();
}

/**
 * Returns organization settings plus capability flags used by the client to
 * decide which admin actions to surface.
 */
export async function getCurrentOrganizationForAccount(
  accountId: string,
  dependencies: OrganizationsServiceDependencies = defaultDependencies,
): Promise<OrganizationSummaryResult> {
  const context = await getOrganizationAccessContext(accountId, dependencies);
  const capabilities = buildOrganizationCapabilities(context.role?.permissions ?? []);
  return {
    organization: {
      ...context.organization,
      joinKey: capabilities.canViewJoinKey ? context.organization.joinKey : null,
      capabilities,
    },
  };
}

/**
 * Rotates the join key for the caller's organization when invite management is
 * permitted by their current role.
 */
export async function regenerateOrganizationJoinKeyForAccount(
  currentAccount: AuthenticatedAccountContext,
  organizationAccessContext: OrganizationAccessContext | undefined,
  dependencies: OrganizationsServiceDependencies = defaultDependencies,
): Promise<OrganizationSummaryResult> {
  const accessContext =
    organizationAccessContext
    ?? await getOrganizationAccessContext(currentAccount.id, dependencies);

  const capabilities = buildOrganizationCapabilities(accessContext.role?.permissions ?? []);

  if (!capabilities.canRegenerateJoinKey) {
    throw new OrganizationPermissionDeniedError(
      "Organization invite permission is required to regenerate the join key",
    );
  }

  let organization: OrganizationRow | null = null;
  let lastError: unknown;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const joinKey = generateOrganizationJoinKey();

    try {
      organization = await dependencies.updateOrganizationJoinKey(
        accessContext.organization.id,
        joinKey,
      );
      break;
    } catch (error) {
      if (
        error instanceof Error
        && "code" in error
        && "constraint" in error
        && (error as { code?: string }).code === "23505"
        && (error as { constraint?: string }).constraint === "organizations_join_key_key"
      ) {
        lastError = error;
        continue;
      }

      throw error;
    }
  }

  if (!organization) {
    throw lastError ?? new Error("Failed to regenerate organization join key");
  }

  return mapOrganizationSummary(organization, capabilities);
}

/**
 * Creates a custom organization role while enforcing role-level hierarchy and
 * permission subset rules.
 */
export async function createOrganizationRoleForAccount(
  currentAccount: AuthenticatedAccountContext,
  command: CreateOrganizationRoleCommand,
  organizationAccessContext: OrganizationAccessContext | undefined,
  dependencies: OrganizationsServiceDependencies = defaultDependencies,
): Promise<OrganizationRoleResult> {
  const accessContext =
    organizationAccessContext
    ?? await getOrganizationAccessContext(currentAccount.id, dependencies);

  const permissions = accessContext.role?.permissions ?? [];
  const canManageRoles = permissions.includes("organization:manage");

  if (!canManageRoles) {
    throw new OrganizationPermissionDeniedError(
      "Organization manage permission is required",
    );
  }

  const currentRoleLevel = accessContext.role?.level;

  if (currentRoleLevel === undefined) {
    throw new OrganizationPermissionDeniedError(
      "A role level is required to manage organization roles",
    );
  }

  if (command.level >= currentRoleLevel) {
    throw new OrganizationPermissionDeniedError(
      "You can only create roles below your current role level",
    );
  }

  const client = await dependencies.getTransactionalClient();

  try {
    await client.query("BEGIN");

    const role = await dependencies.createRoleInTransaction(
      client,
      accessContext.organization.id,
      command.name.trim(),
      command.level,
    );
    await dependencies.assignRolePermissionsInTransaction(
      client,
      role.id,
      command.permissions,
    );

    await client.query("COMMIT");

    return {
      role: mapRoleWithPermissions(
        role,
        command.permissions.map((permission) => ({
          role_id: role.id,
          permission,
        })),
      ),
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Updates another member's role assignment while preventing users from managing
 * peers or superiors in the hierarchy.
 */
export async function updateOrganizationMemberForAccount(
  currentAccount: AuthenticatedAccountContext,
  command: UpdateOrganizationMemberCommand,
  organizationAccessContext: OrganizationAccessContext | undefined,
  dependencies: OrganizationsServiceDependencies = defaultDependencies,
): Promise<OrganizationMemberResult> {
  const accessContext =
    organizationAccessContext
    ?? await getOrganizationAccessContext(currentAccount.id, dependencies);

  const permissions = accessContext.role?.permissions ?? [];
  const canManageMembers =
    permissions.includes("organization:members:manage")
    || permissions.includes("organization:manage");

  if (!canManageMembers) {
    throw new OrganizationPermissionDeniedError(
      "Organization member manage permission is required",
    );
  }

  const currentRoleLevel = accessContext.role?.level;

  if (currentRoleLevel === undefined) {
    throw new OrganizationPermissionDeniedError(
      "A role level is required to manage organization members",
    );
  }

  const members = await dependencies.listOrganizationMembers(
    accessContext.organization.id,
  );
  const targetMember = members.find((member) => member.account_id === command.accountId);

  if (!targetMember) {
    throw new OrganizationNotFoundError();
  }

  const currentTargetRole = targetMember.role_id
    ? await dependencies.findRoleById(targetMember.role_id)
    : null;

  if (currentTargetRole && currentTargetRole.level >= currentRoleLevel) {
    throw new OrganizationPermissionDeniedError(
      "You can only manage members with lower role levels than your own",
    );
  }

  if (command.roleId) {
    const role = await dependencies.findRoleById(command.roleId);

    if (role?.org_id !== accessContext.organization.id) {
      throw new OrganizationPermissionDeniedError(
        "You can only assign roles from your current organization",
      );
    }

    if (role.level >= currentRoleLevel) {
      throw new OrganizationPermissionDeniedError(
        "You can only assign roles below your current role level",
      );
    }
  }

  const member = await dependencies.updateUserInOrganization(
    command.accountId,
    accessContext.organization.id,
    { roleId: command.roleId },
  );

  if (!member) {
    throw new OrganizationNotFoundError();
  }
  const assignedRole = member.role_id
    ? await dependencies.findRoleById(member.role_id)
    : null;

  return {
    member: await mapMemberRow({
      account_id: member.id,
      org_id: member.org_id,
      email: member.email,
      username: member.username,
      name: member.name,
      profile_url: member.profile_url,
      profile_object_key: member.profile_object_key,
      auth_provider: member.auth_provider,
      cognito_sub: member.cognito_sub,
      role_id: member.role_id,
      role_name: assignedRole?.name ?? null,
      created_at: member.created_at,
      updated_at: member.updated_at,
    }),
  };
}

/**
 * Handles both self-leave and higher-role member removal flows, reprovisioning
 * a standalone org for the removed account when required by product rules.
 */
export async function removeOrganizationMemberForAccount(
  currentAccount: AuthenticatedAccountContext,
  command: RemoveOrganizationMemberCommand,
  organizationAccessContext: OrganizationAccessContext | undefined,
  dependencies: OrganizationsServiceDependencies = defaultDependencies,
): Promise<OrganizationMemberRemovalResult> {
  const accessContext =
    organizationAccessContext
    ?? await getOrganizationAccessContext(currentAccount.id, dependencies);

  const members = await dependencies.listOrganizationMembers(
    accessContext.organization.id,
  );
  const targetMember = members.find((member) => member.account_id === command.accountId);

  if (!targetMember) {
    throw new OrganizationNotFoundError();
  }

  const targetIsSelf = targetMember.account_id === currentAccount.id;
  const currentRoleLevel = accessContext.role?.level ?? null;
  const targetRole = targetMember.role_id
    ? await dependencies.findRoleById(targetMember.role_id)
    : null;

  if (targetIsSelf) {
    if ((currentRoleLevel ?? 0) >= OWNER_ROLE_LEVEL) {
      throw new OrganizationPermissionDeniedError(
        "Owners cannot leave the organization. Delete the organization instead.",
      );
    }
  } else {
    const permissions = accessContext.role?.permissions ?? [];
    const canManageMembers =
      permissions.includes("organization:members:manage")
      || permissions.includes("organization:manage");

    if (!canManageMembers) {
      throw new OrganizationPermissionDeniedError(
        "Organization member manage permission is required",
      );
    }

    if (currentRoleLevel === null) {
      throw new OrganizationPermissionDeniedError(
        "A role level is required to remove organization members",
      );
    }

    if (targetRole && targetRole.level >= currentRoleLevel) {
      throw new OrganizationPermissionDeniedError(
        "You can only remove members with lower role levels than your own",
      );
    }
  }

  const client = await dependencies.getTransactionalClient();

  try {
    await client.query("BEGIN");

    const reprovisioned = await provisionStandaloneOrganizationForAccount(
      client,
      targetMember.account_id,
      targetMember.username,
      dependencies,
    );

    await client.query("COMMIT");

    return {
      removedAccountId: targetMember.account_id,
      removedFromOrganizationId: accessContext.organization.id,
      selfRemoved: targetIsSelf,
      account: reprovisioned.account,
      organization: reprovisioned.organization,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Moves a non-owner account into another organization using a validated join
 * key and assigns the lowest non-owner role in the target org.
 */
export async function joinOrganizationForAccount(
  currentAccount: AuthenticatedAccountContext,
  command: JoinOrganizationCommand,
  organizationAccessContext: OrganizationAccessContext | undefined,
  dependencies: OrganizationsServiceDependencies = defaultDependencies,
): Promise<OrganizationMemberRemovalResult> {
  const accessContext =
    organizationAccessContext
    ?? await getOrganizationAccessContext(currentAccount.id, dependencies);

  const currentRoleLevel = accessContext.role?.level ?? null;

  if ((currentRoleLevel ?? 0) >= OWNER_ROLE_LEVEL) {
    throw new OrganizationPermissionDeniedError(
      "Owners cannot join another organization. Delete the organization instead.",
    );
  }

  const normalizedJoinKey = normalizeOrganizationJoinKey(command.joinKey);

  if (!isOrganizationJoinKeyValid(normalizedJoinKey)) {
    throw new OrganizationPermissionDeniedError("Join key must be an 8-character alphanumeric code");
  }

  const client = await dependencies.getTransactionalClient();

  try {
    await client.query("BEGIN");

    const findOrganizationByJoinKeyInTransaction =
      dependencies.findOrganizationByJoinKeyInTransaction;

    if (!findOrganizationByJoinKeyInTransaction) {
      throw new Error("Organization join lookup dependency is unavailable");
    }

    const targetOrganization = await findOrganizationByJoinKeyInTransaction(
      client,
      normalizedJoinKey,
    );

    if (!targetOrganization) {
      throw new OrganizationPermissionDeniedError("Organization join key was not found");
    }

    if (targetOrganization.id === accessContext.organization.id) {
      throw new OrganizationPermissionDeniedError("You are already in this organization");
    }

    const targetRole =
      (await findLowestNonOwnerRoleInTargetOrganization(client, targetOrganization.id, dependencies))
      ?? (await ensureMemberRoleForOrganization(client, targetOrganization.id, dependencies));

    const updatedAccount = await dependencies.updateAccountOrganizationInTransaction(
      client,
      currentAccount.id,
      targetOrganization.id,
      targetRole.id,
    );

    if (!updatedAccount) {
      throw new OrganizationNotFoundError();
    }

    await client.query("COMMIT");

    const capabilities = buildOrganizationCapabilities(
      (
        await dependencies.listRolePermissions(targetRole.id)
      ).map((entry) => entry.permission as Permission),
    );

    return {
      removedAccountId: currentAccount.id,
      removedFromOrganizationId: accessContext.organization.id,
      selfRemoved: true,
      account: await mapPublicAccount(updatedAccount),
      organization: mapOrganizationSummary(targetOrganization, capabilities).organization,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Returns the current organization member count for UI/admin guardrails.
 */
export async function getOrganizationMemberCountForAccount(
  accountId: string,
  dependencies: OrganizationsServiceDependencies = defaultDependencies,
): Promise<OrganizationMemberCountResult> {
  const context = await getOrganizationAccessContext(accountId, dependencies);
  const rows = await dependencies.listOrganizationMembers(context.organization.id);

  return {
    organization: context.organization,
    memberCount: rows.length,
  };
}

/**
 * Creates a standalone organization for the caller, including bootstrap roles
 * and membership wiring.
 */
export async function createOrganizationForAccount(
  _currentAccount: AuthenticatedAccountContext,
  command: CreateOrganizationCommand,
  dependencies: OrganizationsServiceDependencies = defaultDependencies,
): Promise<OrganizationSummaryResult> {
  const basePermissions = dependencies.getBasePermissions();

  if (!basePermissions.includes("organization:create")) {
    throw new OrganizationPermissionDeniedError(
      "Organization create permission is required",
    );
  }

  const client = await dependencies.getTransactionalClient();

  try {
    await client.query("BEGIN");

    const organization = await createOrganizationWithGeneratedJoinKeyInTransaction(
      client,
      command.name.trim(),
      dependencies.createOrganizationInTransaction,
    );
    const ownerRole = await dependencies.createRoleInTransaction(
      client,
      organization.id,
      OWNER_ROLE_NAME,
      OWNER_ROLE_LEVEL,
    );
    const memberRole = await dependencies.createRoleInTransaction(
      client,
      organization.id,
      MEMBER_ROLE_NAME,
      MEMBER_ROLE_LEVEL,
    );
    await dependencies.assignRolePermissionsInTransaction(
      client,
      ownerRole.id,
      OWNER_ROLE_PERMISSIONS,
    );
    await dependencies.assignRolePermissionsInTransaction(
      client,
      memberRole.id,
      MEMBER_ROLE_PERMISSIONS,
    );

    const updatedAccount =
      await dependencies.updateAccountOrganizationInTransaction(
        client,
        _currentAccount.id,
        organization.id,
        ownerRole.id,
      );

    if (!updatedAccount) {
      throw new OrganizationNotFoundError();
    }

    await client.query("COMMIT");
    return mapOrganizationSummary(organization);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Updates mutable organization settings such as thresholds and display name.
 */
export async function updateOrganizationForAccount(
  currentAccount: AuthenticatedAccountContext,
  command: UpdateOrganizationCommand,
  organizationAccessContext: OrganizationAccessContext | undefined,
  dependencies: OrganizationsServiceDependencies = defaultDependencies,
): Promise<OrganizationSummaryResult> {
  const accessContext =
    organizationAccessContext
    ?? await getOrganizationAccessContext(currentAccount.id, dependencies);

  if (accessContext.organization.id !== command.organizationId) {
    throw new OrganizationPermissionDeniedError(
      "You can only update your current organization",
    );
  }

  const permissions = accessContext.role?.permissions ?? [];
  const canUpdate =
    permissions.includes("organization:update")
    || permissions.includes("organization:manage");

  if (!canUpdate) {
    throw new OrganizationPermissionDeniedError(
      "Organization update permission is required",
    );
  }

  const currentOrganization = await dependencies.findOrganizationById(
    command.organizationId,
  );

  if (!currentOrganization) {
    throw new OrganizationNotFoundError();
  }

  const criticalStockThreshold =
    command.criticalStockThreshold ?? currentOrganization.critical_stock_threshold;
  const lowStockThreshold =
    command.lowStockThreshold ?? currentOrganization.low_stock_threshold;

  if (lowStockThreshold < criticalStockThreshold) {
    throw new OrganizationPermissionDeniedError(
      "Low stock threshold must be greater than or equal to critical stock threshold",
    );
  }

  const organization = await dependencies.updateOrganization(command.organizationId, {
    name: command.name?.trim() ?? currentOrganization.name ?? "Organization workspace",
    criticalStockThreshold,
    lowStockThreshold,
  });

  if (!organization) {
    throw new OrganizationNotFoundError();
  }

  return mapOrganizationSummary(organization);
}

/**
 * Deletes the current organization when the caller is authorized and the org
 * satisfies the deletion preconditions enforced by the backend.
 */
export async function deleteOrganizationForAccount(
  currentAccount: AuthenticatedAccountContext,
  command: DeleteOrganizationCommand,
  organizationAccessContext: OrganizationAccessContext | undefined,
  dependencies: OrganizationsServiceDependencies = defaultDependencies,
): Promise<OrganizationSummaryResult> {
  const accessContext =
    organizationAccessContext
    ?? await getOrganizationAccessContext(currentAccount.id, dependencies);

  if (accessContext.organization.id !== command.organizationId) {
    throw new OrganizationPermissionDeniedError(
      "You can only delete your current organization",
    );
  }

  const permissions = accessContext.role?.permissions ?? [];
  const canDelete = permissions.includes("organization:manage");

  if (!canDelete) {
    throw new OrganizationPermissionDeniedError(
      "Organization manage permission is required",
    );
  }

  try {
    const organization = await dependencies.deleteOrganization(command.organizationId);

    if (!organization) {
      throw new OrganizationNotFoundError();
    }

    return mapOrganizationSummary(organization);
  } catch (error) {
    if (
      error instanceof Error
      && "code" in error
      && (error as { code?: string }).code === "23503"
    ) {
      throw new OrganizationDeleteBlockedError();
    }

    throw error;
  }
}

function mapAccessContext(
  row: OrganizationAccessContextRow,
  permissions: OrganizationRolePermissionRow[],
): OrganizationAccessContext {
  const mappedPermissions = permissions.map((entry) => entry.permission as Permission);

  return {
    accountId: row.account_id,
    organization: {
      id: row.org_id,
      name: row.org_name,
      joinKey: row.org_join_key,
      criticalStockThreshold: row.org_critical_stock_threshold,
      lowStockThreshold: row.org_low_stock_threshold,
      capabilities: buildOrganizationCapabilities(mappedPermissions),
    },
    role: row.role_id
      ? {
          id: row.role_id,
          orgId: row.org_id,
          name: row.role_name ?? "unknown",
          level: row.role_level ?? 0,
          createdAt: "",
          permissions: mappedPermissions,
        }
      : null,
  };
}

async function mapMemberRow(row: OrganizationMemberRow): Promise<OrganizationMember> {
  return {
    accountId: row.account_id,
    orgId: row.org_id,
    email: row.email,
    username: row.username,
    name: row.name,
    profileUrl: await resolveStoredImageUrl(
      row.profile_object_key,
      row.profile_url,
    ),
    authProvider: row.auth_provider as OrganizationMember["authProvider"],
    cognitoSub: row.cognito_sub,
    roleId: row.role_id,
    roleName: row.role_name,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

async function mapPublicAccount(row: {
  id: string;
  org_id: string;
  profile_url: string | null;
  profile_object_key: string | null;
  name: string | null;
  email: string;
  username: string;
  auth_provider: "backend" | "cognito" | string;
  cognito_sub: string | null;
  role_id: string | null;
}): Promise<PublicAuthAccount> {
  return {
    id: row.id,
    orgId: row.org_id,
    profileUrl: await resolveStoredImageUrl(
      row.profile_object_key,
      row.profile_url,
    ),
    name: row.name,
    email: row.email,
    username: row.username,
    authProvider: row.auth_provider as PublicAuthAccount["authProvider"],
    cognitoSub: row.cognito_sub,
    roleId: row.role_id,
  };
}

function buildOrganizationCapabilities(
  permissions: readonly Permission[],
): OrganizationSummaryResult["organization"]["capabilities"] {
  const canManageOrganization = permissions.includes("organization:manage");
  const canInviteMembers =
    permissions.includes("organization:members:invite") || canManageOrganization;

  return {
    canDeleteOrganization: canManageOrganization,
    canRegenerateJoinKey: canInviteMembers,
    canViewJoinKey: canInviteMembers,
  };
}

function buildDefaultOrganizationName(username: string): string {
  const trimmed = username.trim();
  return trimmed.length > 0 ? `${trimmed}'s Organization` : "My Organization";
}

async function ensureMemberRoleForOrganization(
  client: TransactionClientLike,
  organizationId: string,
  dependencies: OrganizationsServiceDependencies,
): Promise<OrganizationRoleRow> {
  const existingRoles = await dependencies.listOrganizationRoles(organizationId);
  const memberRole = existingRoles.find((role) => role.name === MEMBER_ROLE_NAME);

  if (memberRole) {
    return memberRole;
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

async function findLowestNonOwnerRoleInTargetOrganization(
  client: TransactionClientLike,
  organizationId: string,
  dependencies: OrganizationsServiceDependencies,
): Promise<OrganizationRoleRow | null> {
  const roles = await dependencies.listOrganizationRoles(organizationId);
  const nonOwnerRoles = roles.filter((role) => role.level < OWNER_ROLE_LEVEL);

  if (nonOwnerRoles.length === 0) {
    return null;
  }

  return [...nonOwnerRoles].sort((left, right) => {
    if (left.level !== right.level) {
      return left.level - right.level;
    }
    return left.created_at.getTime() - right.created_at.getTime();
  })[0] ?? null;
}

async function provisionStandaloneOrganizationForAccount(
  client: TransactionClientLike,
  accountId: string,
  username: string,
  dependencies: OrganizationsServiceDependencies,
): Promise<{
  account: PublicAuthAccount;
  organization: OrganizationSummaryResult["organization"];
}> {
  const organization = await createOrganizationWithGeneratedJoinKeyInTransaction(
    client,
    buildDefaultOrganizationName(username),
    dependencies.createOrganizationInTransaction,
  );
  const ownerRole = await dependencies.createRoleInTransaction(
    client,
    organization.id,
    OWNER_ROLE_NAME,
    OWNER_ROLE_LEVEL,
  );
  const memberRole = await dependencies.createRoleInTransaction(
    client,
    organization.id,
    MEMBER_ROLE_NAME,
    MEMBER_ROLE_LEVEL,
  );

  await dependencies.assignRolePermissionsInTransaction(
    client,
    ownerRole.id,
    OWNER_ROLE_PERMISSIONS,
  );
  await dependencies.assignRolePermissionsInTransaction(
    client,
    memberRole.id,
    MEMBER_ROLE_PERMISSIONS,
  );

  const updatedAccount = await dependencies.updateAccountOrganizationInTransaction(
    client,
    accountId,
    organization.id,
    ownerRole.id,
  );

  if (!updatedAccount) {
    throw new OrganizationNotFoundError();
  }

  return {
    account: await mapPublicAccount(updatedAccount),
    organization: mapOrganizationSummary(organization).organization,
  };
}

function mapRoleWithPermissions(
  row: OrganizationRoleRow,
  permissions: OrganizationRolePermissionRow[],
) {
  return {
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    level: row.level,
    createdAt: row.created_at.toISOString(),
    permissions: permissions.map((entry) => entry.permission as Permission),
  };
}

type OrganizationSummaryResult = {
  organization: {
    id: string;
    name: string | null;
    joinKey: string | null;
    criticalStockThreshold: number;
    lowStockThreshold: number;
    capabilities: {
      canDeleteOrganization: boolean;
      canRegenerateJoinKey: boolean;
      canViewJoinKey: boolean;
    };
  };
};

type OrganizationRoleResult = {
  role: {
    id: string;
    orgId: string;
    name: string;
    level: number;
    createdAt: string;
    permissions: Permission[];
  };
};

type OrganizationRoleWithPermissionsResult = {
  roles: {
    id: string;
    orgId: string;
    name: string;
    level: number;
    createdAt: string;
    permissions: Permission[];
  }[];
};

type OrganizationMemberResult = {
  member: OrganizationMember;
};

type OrganizationPermissionCatalogResult = {
  permissions: {
    id: number;
    key: Permission;
  }[];
  permissionMap: Partial<Record<Permission, number>>;
};

type OrganizationMemberCountResult = {
  organization: {
    id: string;
    name: string | null;
    joinKey: string | null;
    criticalStockThreshold: number;
    lowStockThreshold: number;
  };
  memberCount: number;
};

type OrganizationMemberRemovalResult = {
  removedAccountId: string;
  removedFromOrganizationId: string;
  selfRemoved: boolean;
  account: PublicAuthAccount;
  organization: {
    id: string;
    name: string | null;
    joinKey: string | null;
    criticalStockThreshold: number;
    lowStockThreshold: number;
    capabilities: {
      canDeleteOrganization: boolean;
      canRegenerateJoinKey: boolean;
      canViewJoinKey: boolean;
    };
  };
};

function mapOrganizationSummary(
  row: OrganizationRow,
  capabilities: OrganizationSummaryResult["organization"]["capabilities"] = {
    canDeleteOrganization: true,
    canRegenerateJoinKey: true,
    canViewJoinKey: true,
  },
): OrganizationSummaryResult {
  return {
    organization: {
      id: row.id,
      name: row.name,
      joinKey: capabilities.canViewJoinKey ? row.join_key : null,
      criticalStockThreshold: row.critical_stock_threshold,
      lowStockThreshold: row.low_stock_threshold,
      capabilities,
    },
  };
}
