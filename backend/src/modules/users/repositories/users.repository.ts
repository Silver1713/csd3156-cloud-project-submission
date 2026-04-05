import { query } from "../../../db/client.js";
import type { UserAccountRow } from "../types/users.db.types.js";

export async function findUserById(
  userId: string,
): Promise<UserAccountRow | null> {
  const rows = await query<UserAccountRow>(
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
        role_id,
        created_at,
        updated_at
      FROM auth.accounts
      WHERE id = $1
      LIMIT 1
    `,
    [userId],
  );

  return rows[0] ?? null;
}

export async function updateCurrentUserProfile(
  userId: string,
  input: {
    name?: string | null | undefined;
    profileUrl?: string | null | undefined;
    profileObjectKey?: string | null | undefined;
  },
): Promise<UserAccountRow | null> {
  const rows = await query<UserAccountRow>(
    `
      UPDATE auth.accounts
      SET
        name = CASE WHEN $2::boolean THEN $3 ELSE name END,
        profile_url = CASE WHEN $4::boolean THEN $5 ELSE profile_url END,
        profile_object_key = CASE WHEN $6::boolean THEN $7 ELSE profile_object_key END,
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
        role_id,
        created_at,
        updated_at
    `,
    [
      userId,
      input.name !== undefined,
      input.name ?? null,
      input.profileUrl !== undefined,
      input.profileUrl ?? null,
      input.profileObjectKey !== undefined,
      input.profileObjectKey ?? null,
    ],
  );

  return rows[0] ?? null;
}

export async function updateUserInOrganization(
  userId: string,
  orgId: string,
  input: {
    name?: string | null | undefined;
    profileUrl?: string | null | undefined;
    profileObjectKey?: string | null | undefined;
    email?: string | undefined;
    username?: string | undefined;
    roleId?: string | null | undefined;
  },
): Promise<UserAccountRow | null> {
  const rows = await query<UserAccountRow>(
    `
      UPDATE auth.accounts
      SET
        name = CASE WHEN $3::boolean THEN $4 ELSE name END,
        profile_url = CASE WHEN $5::boolean THEN $6 ELSE profile_url END,
        profile_object_key = CASE WHEN $7::boolean THEN $8 ELSE profile_object_key END,
        email = CASE WHEN $9::boolean THEN $10 ELSE email END,
        username = CASE WHEN $11::boolean THEN $12 ELSE username END,
        role_id = CASE WHEN $13::boolean THEN $14 ELSE role_id END,
        updated_at = now()
      WHERE id = $1
        AND org_id = $2
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
        role_id,
        created_at,
        updated_at
    `,
    [
      userId,
      orgId,
      input.name !== undefined,
      input.name ?? null,
      input.profileUrl !== undefined,
      input.profileUrl ?? null,
      input.profileObjectKey !== undefined,
      input.profileObjectKey ?? null,
      input.email !== undefined,
      input.email ?? null,
      input.username !== undefined,
      input.username ?? null,
      input.roleId !== undefined,
      input.roleId ?? null,
    ],
  );

  return rows[0] ?? null;
}
