import type { PoolClient } from "pg";

import { query } from "../../../db/client.js";
import type { AuthAccountRow } from "../types/auth.db.types.js";
import type { CreateAccountInput } from "../types/auth.command.types.js";

export async function findAccountByUsername(
  username: string,
): Promise<AuthAccountRow | null> {
  const rows = await query<AuthAccountRow>(
    `
      SELECT
        id,
        org_id,
        profile_url,
        profile_object_key,
        name,
        email,
        username,
        auth_provider,
        cognito_sub,
        password_hash,
        role_id,
        created_at,
        updated_at
      FROM auth.accounts
      WHERE username = $1
      LIMIT 1
    `,
    [username],
  );

  return rows[0] ?? null;
}

export async function findAccountById(
  accountId: string,
): Promise<AuthAccountRow | null> {
  const rows = await query<AuthAccountRow>(
    `
      SELECT
        id,
        org_id,
        profile_url,
        profile_object_key,
        name,
        email,
        username,
        auth_provider,
        cognito_sub,
        password_hash,
        role_id,
        created_at,
        updated_at
      FROM auth.accounts
      WHERE id = $1
      LIMIT 1
    `,
    [accountId],
  );

  return rows[0] ?? null;
}

export async function findAccountByEmail(
  email: string,
): Promise<AuthAccountRow[]> {
  return query<AuthAccountRow>(
    `
      SELECT
        id,
        org_id,
        profile_url,
        profile_object_key,
        name,
        email,
        username,
        auth_provider,
        cognito_sub,
        password_hash,
        role_id,
        created_at,
        updated_at
      FROM auth.accounts
      WHERE email = $1
    `,
    [email],
  );
}

export async function findAccountByCognitoSub(
  cognitoSub: string,
): Promise<AuthAccountRow | null> {
  const rows = await query<AuthAccountRow>(
    `
      SELECT
        id,
        org_id,
        profile_url,
        profile_object_key,
        name,
        email,
        username,
        auth_provider,
        cognito_sub,
        password_hash,
        role_id,
        created_at,
        updated_at
      FROM auth.accounts
      WHERE cognito_sub = $1
      LIMIT 1
    `,
    [cognitoSub],
  );

  return rows[0] ?? null;
}

export async function getAllAccounts(): Promise<AuthAccountRow[]> {
  const rows = await query<AuthAccountRow>(
    `
      SELECT
        id,
        org_id,
        profile_url,
        profile_object_key,
        name,
        email,
        username,
        auth_provider,
        cognito_sub,
        password_hash,
        role_id,
        created_at,
        updated_at
      FROM auth.accounts
    `,
  );
  return rows;
}

export async function createAccount(
  input: CreateAccountInput,
): Promise<AuthAccountRow> {
  return createAccountInTransaction(undefined, input);
}

export async function createAccountInTransaction(
  client: PoolClient | undefined,
  input: CreateAccountInput,
): Promise<AuthAccountRow> {
  const execute = client
    ? async (
        text: string,
        params: readonly unknown[],
      ): Promise<AuthAccountRow[]> => {
        const result = await client.query<AuthAccountRow>(text, [...params]);
        return result.rows;
      }
    : async (
        text: string,
        params: readonly unknown[],
      ): Promise<AuthAccountRow[]> => query<AuthAccountRow>(text, params);

  const rows = await execute(
    `
      INSERT INTO auth.accounts
        (org_id, email, username, auth_provider, cognito_sub, password_hash, role_id)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7)
      RETURNING
        id,
        org_id,
        profile_url,
        profile_object_key,
        name,
        email,
        username,
        auth_provider,
        cognito_sub,
        password_hash,
        role_id,
        created_at,
        updated_at
    `,
    [
      input.orgId,
      input.email,
      input.username,
      input.authProvider,
      input.cognitoSub,
      input.passwordHash,
      input.roleId,
    ],
  );

  const account = rows[0];

  if (!account) {
    throw new Error("Failed to create account");
  }

  return account;
}

export async function updatePassword(
  accountId: string,
  passwordHash: string,
): Promise<AuthAccountRow | null> {
  const rows = await query<AuthAccountRow>(
    `
      UPDATE auth.accounts
      SET
        password_hash = $2,
        updated_at = now()
      WHERE id = $1
      RETURNING
        id,
        org_id,
        profile_url,
        profile_object_key,
        name,
        email,
        username,
        auth_provider,
        cognito_sub,
        password_hash,
        role_id,
        created_at,
        updated_at
    `,
    [accountId, passwordHash],
  );

  return rows[0] ?? null;
}

export async function updatePasswordByUsername(
  username: string,
  passwordHash: string,
): Promise<AuthAccountRow | null> {
  const rows = await query<AuthAccountRow>(
    `
      UPDATE auth.accounts
      SET
        password_hash = $2,
        updated_at = now()
      WHERE username = $1
      RETURNING
        id,
        org_id,
        profile_url,
        profile_object_key,
        name,
        email,
        username,
        auth_provider,
        cognito_sub,
        password_hash,
        role_id,
        created_at,
        updated_at
    `,
    [username, passwordHash],
  );

  return rows[0] ?? null;
}

export async function deleteAccount(
  accountId: string,
): Promise<AuthAccountRow | null> {
  return deleteAccountInTransaction(undefined, accountId);
}

export async function deleteAccountInTransaction(
  client: PoolClient | undefined,
  accountId: string,
): Promise<AuthAccountRow | null> {
  const execute = client
    ? async (
        text: string,
        params: readonly unknown[],
      ): Promise<AuthAccountRow[]> => {
        const result = await client.query<AuthAccountRow>(text, [...params]);
        return result.rows;
      }
    : async (
        text: string,
        params: readonly unknown[],
      ): Promise<AuthAccountRow[]> => query<AuthAccountRow>(text, params);

  const rows = await execute(
    `
      DELETE FROM auth.accounts
      WHERE id = $1
      RETURNING
        id,
        org_id,
        profile_url,
        profile_object_key,
        name,
        email,
        username,
        auth_provider,
        cognito_sub,
        password_hash,
        role_id,
        created_at,
        updated_at
    `,
    [accountId],
  );

  return rows[0] ?? null;
}

export async function clearAccountRoleInTransaction(
  client: PoolClient | undefined,
  accountId: string,
): Promise<AuthAccountRow | null> {
  const execute = client
    ? async (
        text: string,
        params: readonly unknown[],
      ): Promise<AuthAccountRow[]> => {
        const result = await client.query<AuthAccountRow>(text, [...params]);
        return result.rows;
      }
    : async (
        text: string,
        params: readonly unknown[],
      ): Promise<AuthAccountRow[]> => query<AuthAccountRow>(text, params);

  const rows = await execute(
    `
      UPDATE auth.accounts
      SET
        role_id = NULL,
        updated_at = now()
      WHERE id = $1
      RETURNING
        id,
        org_id,
        profile_url,
        profile_object_key,
        name,
        email,
        username,
        auth_provider,
        cognito_sub,
        password_hash,
        role_id,
        created_at,
        updated_at
    `,
    [accountId],
  );

  return rows[0] ?? null;
}

export async function updateAccountOrganization(
  accountId: string,
  orgId: string,
  roleId: string | null = null,
): Promise<AuthAccountRow | null> {
  return updateAccountOrganizationInTransaction(undefined, accountId, orgId, roleId);
}

export async function updateAccountOrganizationInTransaction(
  client: PoolClient | undefined,
  accountId: string,
  orgId: string,
  roleId: string | null = null,
): Promise<AuthAccountRow | null> {
  const execute = client
    ? async (
        text: string,
        params: readonly unknown[],
      ): Promise<AuthAccountRow[]> => {
        const result = await client.query<AuthAccountRow>(text, [...params]);
        return result.rows;
      }
    : async (
        text: string,
        params: readonly unknown[],
      ): Promise<AuthAccountRow[]> => query<AuthAccountRow>(text, params);

  const rows = await execute(
    `
      UPDATE auth.accounts
      SET
        org_id = $2,
        role_id = $3,
        updated_at = now()
      WHERE id = $1
      RETURNING
        id,
        org_id,
        profile_url,
        profile_object_key,
        name,
        email,
        username,
        auth_provider,
        cognito_sub,
        password_hash,
        role_id,
        created_at,
        updated_at
    `,
    [accountId, orgId, roleId],
  );

  return rows[0] ?? null;
}


export async function getAccountsByOrgId(orgId: string): Promise<AuthAccountRow[]> {
  return query<AuthAccountRow>(
    `
      SELECT
        id,
        org_id,
        profile_url,
        profile_object_key,
        name,
        email,
        username,
        auth_provider,
        cognito_sub,
        password_hash,
        role_id,
        created_at,
        updated_at
      FROM auth.accounts
      WHERE org_id = $1
    `,
    [orgId],
  );
}
