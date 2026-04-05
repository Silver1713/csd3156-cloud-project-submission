import type { PoolClient } from "pg";

import { query } from "../../../db/client.js";
import type {
  OrganizationAccessContextRow,
  OrganizationMemberRow,
  OrganizationRolePermissionRow,
  OrganizationRoleRow,
  OrganizationRow,
} from "../types/organizations.db.types.js";

export async function findOrganizationById(
  orgId: string,
): Promise<OrganizationRow | null> {
  const rows = await query<OrganizationRow>(
    `
      SELECT
        id,
        name,
        join_key,
        critical_stock_threshold,
        low_stock_threshold
      FROM auth.organizations
      WHERE id = $1
      LIMIT 1
    `,
    [orgId],
  );

  return rows[0] ?? null;
}

export async function findOrganizationByJoinKeyInTransaction(
  client: PoolClient,
  joinKey: string,
): Promise<OrganizationRow | null> {
  const result = await client.query<OrganizationRow>(
    `
      SELECT
        id,
        name,
        join_key,
        critical_stock_threshold,
        low_stock_threshold
      FROM auth.organizations
      WHERE join_key = $1
      LIMIT 1
    `,
    [joinKey],
  );

  return result.rows[0] ?? null;
}

export async function findOrganizationByNameInTransaction(
  client: PoolClient,
  name: string,
): Promise<OrganizationRow | null> {
  const result = await client.query<OrganizationRow>(
    `
      SELECT
        id,
        name,
        join_key,
        critical_stock_threshold,
        low_stock_threshold
      FROM auth.organizations
      WHERE name = $1
      ORDER BY id ASC
      LIMIT 1
    `,
    [name],
  );

  return result.rows[0] ?? null;
}

export async function createOrganization(
  name: string,
  joinKey: string,
): Promise<OrganizationRow> {
  const rows = await query<OrganizationRow>(
    `
      INSERT INTO auth.organizations (name, join_key)
      VALUES ($1, $2)
      RETURNING id, name, join_key, critical_stock_threshold, low_stock_threshold
    `,
    [name, joinKey],
  );

  const organization = rows[0];

  if (!organization) {
    throw new Error("Failed to create organization");
  }

  return organization;
}

export async function updateOrganization(
  orgId: string,
  input: {
    name: string;
    criticalStockThreshold: number;
    lowStockThreshold: number;
  },
): Promise<OrganizationRow | null> {
  const rows = await query<OrganizationRow>(
    `
      UPDATE auth.organizations
      SET
        name = $2,
        critical_stock_threshold = $3,
        low_stock_threshold = $4
      WHERE id = $1
      RETURNING id, name, join_key, critical_stock_threshold, low_stock_threshold
    `,
    [orgId, input.name, input.criticalStockThreshold, input.lowStockThreshold],
  );

  return rows[0] ?? null;
}

export async function updateOrganizationJoinKey(
  orgId: string,
  joinKey: string,
): Promise<OrganizationRow | null> {
  const rows = await query<OrganizationRow>(
    `
      UPDATE auth.organizations
      SET join_key = $2
      WHERE id = $1
      RETURNING id, name, join_key, critical_stock_threshold, low_stock_threshold
    `,
    [orgId, joinKey],
  );

  return rows[0] ?? null;
}

export async function deleteOrganization(
  orgId: string,
): Promise<OrganizationRow | null> {
  return deleteOrganizationInTransaction(undefined, orgId);
}

export async function deleteOrganizationInTransaction(
  client: PoolClient | undefined,
  orgId: string,
): Promise<OrganizationRow | null> {
  const execute = client
    ? async (
        text: string,
        params: readonly unknown[],
      ): Promise<OrganizationRow[]> => {
        const result = await client.query<OrganizationRow>(text, [...params]);
        return result.rows;
      }
    : async (
        text: string,
        params: readonly unknown[],
      ): Promise<OrganizationRow[]> => query<OrganizationRow>(text, params);

  const rows = await execute(
    `
      DELETE FROM auth.organizations
      WHERE id = $1
      RETURNING id, name, join_key, critical_stock_threshold, low_stock_threshold
    `,
    [orgId],
  );

  return rows[0] ?? null;
}

export async function findOrganizationAccessContextByAccountId(
  accountId: string,
): Promise<OrganizationAccessContextRow | null> {
  const rows = await query<OrganizationAccessContextRow>(
    `
      SELECT
        a.id AS account_id,
        a.org_id,
        o.name AS org_name,
        o.join_key AS org_join_key,
        o.critical_stock_threshold AS org_critical_stock_threshold,
        o.low_stock_threshold AS org_low_stock_threshold,
        r.id AS role_id,
        r.name AS role_name,
        r.level AS role_level
      FROM auth.accounts a
      INNER JOIN auth.organizations o ON o.id = a.org_id
      LEFT JOIN auth.roles r ON r.id = a.role_id
      WHERE a.id = $1
      LIMIT 1
    `,
    [accountId],
  );

  return rows[0] ?? null;
}

export async function findRoleById(
  roleId: string,
): Promise<OrganizationRoleRow | null> {
  const rows = await query<OrganizationRoleRow>(
    `
      SELECT
        id,
        org_id,
        name,
        level,
        created_at
      FROM auth.roles
      WHERE id = $1
      LIMIT 1
    `,
    [roleId],
  );

  return rows[0] ?? null;
}

export async function findRoleByNameInTransaction(
  client: PoolClient,
  orgId: string,
  name: string,
): Promise<OrganizationRoleRow | null> {
  const result = await client.query<OrganizationRoleRow>(
    `
      SELECT
        id,
        org_id,
        name,
        level,
        created_at
      FROM auth.roles
      WHERE org_id = $1
        AND name = $2
      ORDER BY created_at ASC
      LIMIT 1
    `,
    [orgId, name],
  );

  return result.rows[0] ?? null;
}

export async function findLowestNonOwnerRoleInTransaction(
  client: PoolClient,
  orgId: string,
): Promise<OrganizationRoleRow | null> {
  const result = await client.query<OrganizationRoleRow>(
    `
      SELECT
        id,
        org_id,
        name,
        level,
        created_at
      FROM auth.roles
      WHERE org_id = $1
        AND level < 255
      ORDER BY level ASC, created_at ASC
      LIMIT 1
    `,
    [orgId],
  );

  return result.rows[0] ?? null;
}

export async function listRolePermissions(
  roleId: string,
): Promise<OrganizationRolePermissionRow[]> {
  return query<OrganizationRolePermissionRow>(
    `
      SELECT
        role_id,
        permission
      FROM auth.role_permissions
      WHERE role_id = $1
      ORDER BY permission ASC
    `,
    [roleId],
  );
}

export async function listOrganizationRoles(
  orgId: string,
): Promise<OrganizationRoleRow[]> {
  return query<OrganizationRoleRow>(
    `
      SELECT
        id,
        org_id,
        name,
        level,
        created_at
      FROM auth.roles
      WHERE org_id = $1
      ORDER BY level DESC, name ASC, created_at ASC
    `,
    [orgId],
  );
}

export async function listOrganizationMembers(
  orgId: string,
): Promise<OrganizationMemberRow[]> {
  return query<OrganizationMemberRow>(
    `
      SELECT
        a.id AS account_id,
        a.org_id,
        a.email,
        a.username,
        a.name,
        a.profile_url,
        a.profile_object_key,
        a.auth_provider,
        a.cognito_sub,
        a.role_id,
        r.name AS role_name,
        r.level AS role_level,
        a.created_at,
        a.updated_at
      FROM auth.accounts a
      LEFT JOIN auth.roles r ON r.id = a.role_id
      WHERE a.org_id = $1
      ORDER BY COALESCE(a.name, a.username) ASC, a.created_at ASC
    `,
    [orgId],
  );
}

export async function createOrganizationInTransaction(
  client: PoolClient,
  name: string,
  joinKey: string,
): Promise<OrganizationRow> {
  const result = await client.query<OrganizationRow>(
    `
      INSERT INTO auth.organizations (name, join_key)
      VALUES ($1, $2)
      RETURNING id, name, join_key, critical_stock_threshold, low_stock_threshold
    `,
    [name, joinKey],
  );

  const row = result.rows[0];

  if (!row) {
    throw new Error("Failed to create organization");
  }

  return row;
}

export async function createRoleInTransaction(
  client: PoolClient,
  orgId: string,
  name: string,
  level: number,
): Promise<OrganizationRoleRow> {
  const result = await client.query<OrganizationRoleRow>(
    `
      INSERT INTO auth.roles (org_id, name, level, created_at)
      VALUES ($1, $2, $3, now())
      RETURNING id, org_id, name, level, created_at
    `,
    [orgId, name, level],
  );

  const row = result.rows[0];

  if (!row) {
    throw new Error("Failed to create role");
  }

  return row;
}

export async function deleteRolePermissionsInTransaction(
  client: PoolClient,
  roleId: string,
): Promise<void> {
  await client.query(
    `
      DELETE FROM auth.role_permissions
      WHERE role_id = $1
    `,
    [roleId],
  );
}

export async function assignRolePermissionsInTransaction(
  client: PoolClient,
  roleId: string,
  permissions: readonly string[],
): Promise<void> {
  if (permissions.length === 0) {
    return;
  }

  const values = permissions
    .map((_, index) => `($1, $${index + 2})`)
    .join(", ");

  await client.query(
    `
      INSERT INTO auth.role_permissions (role_id, permission)
      VALUES ${values}
    `,
    [roleId, ...permissions],
  );
}
