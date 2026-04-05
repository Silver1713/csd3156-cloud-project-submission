import { query } from "../../../db/client.js";
import type { AlertDefinitionRow } from "../types/alert-definition.types.js";

export async function listAlertDefinitionsByOrgId(
  orgId: string,
): Promise<AlertDefinitionRow[]> {
  return query<AlertDefinitionRow>(
    `
      SELECT
        id,
        org_id,
        key,
        name,
        description,
        severity,
        scope,
        condition_json,
        is_active,
        created_by,
        created_at,
        updated_at
      FROM analytics.alert_definitions
      WHERE org_id = $1
      ORDER BY created_at DESC, name ASC
    `,
    [orgId],
  );
}

export async function listActiveAlertDefinitionsByOrgId(
  orgId: string,
): Promise<AlertDefinitionRow[]> {
  return query<AlertDefinitionRow>(
    `
      SELECT
        id,
        org_id,
        key,
        name,
        description,
        severity,
        scope,
        condition_json,
        is_active,
        created_by,
        created_at,
        updated_at
      FROM analytics.alert_definitions
      WHERE org_id = $1
        AND is_active = true
      ORDER BY created_at DESC, name ASC
    `,
    [orgId],
  );
}

export async function selectAlertDefinitionById(
  alertDefinitionId: string,
  orgId: string,
): Promise<AlertDefinitionRow | null> {
  const rows = await query<AlertDefinitionRow>(
    `
      SELECT
        id,
        org_id,
        key,
        name,
        description,
        severity,
        scope,
        condition_json,
        is_active,
        created_by,
        created_at,
        updated_at
      FROM analytics.alert_definitions
      WHERE id = $1
        AND org_id = $2
      LIMIT 1
    `,
    [alertDefinitionId, orgId],
  );

  return rows[0] ?? null;
}

export async function createAlertDefinition(input: {
  orgId: string;
  key: string;
  name: string;
  description?: string | null;
  severity: "low" | "medium" | "high";
  scope: "organization" | "product" | "category";
  condition: unknown;
  createdBy: string;
}): Promise<AlertDefinitionRow> {
  const rows = await query<AlertDefinitionRow>(
    `
      INSERT INTO analytics.alert_definitions (
        org_id,
        key,
        name,
        description,
        severity,
        scope,
        condition_json,
        created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
      RETURNING
        id,
        org_id,
        key,
        name,
        description,
        severity,
        scope,
        condition_json,
        is_active,
        created_by,
        created_at,
        updated_at
    `,
    [
      input.orgId,
      input.key,
      input.name,
      input.description ?? null,
      input.severity,
      input.scope,
      JSON.stringify(input.condition),
      input.createdBy,
    ],
  );

  const row = rows[0];
  if (!row) {
    throw new Error("Failed to create alert definition");
  }
  return row;
}

export async function updateAlertDefinition(input: {
  alertDefinitionId: string;
  orgId: string;
  name?: string | undefined;
  description?: string | null | undefined;
  severity?: "low" | "medium" | "high" | undefined;
  scope?: "organization" | "product" | "category" | undefined;
  condition?: unknown;
  isActive?: boolean | undefined;
}): Promise<AlertDefinitionRow | null> {
  const setClauses: string[] = [];
  const values: unknown[] = [input.alertDefinitionId, input.orgId];

  if (input.name !== undefined) {
    values.push(input.name);
    setClauses.push(`name = $${values.length}`);
  }

  if (input.description !== undefined) {
    values.push(input.description);
    setClauses.push(`description = $${values.length}`);
  }

  if (input.severity !== undefined) {
    values.push(input.severity);
    setClauses.push(`severity = $${values.length}`);
  }

  if (input.scope !== undefined) {
    values.push(input.scope);
    setClauses.push(`scope = $${values.length}`);
  }

  if (input.condition !== undefined) {
    values.push(JSON.stringify(input.condition));
    setClauses.push(`condition_json = $${values.length}::jsonb`);
  }

  if (input.isActive !== undefined) {
    values.push(input.isActive);
    setClauses.push(`is_active = $${values.length}`);
  }

  if (setClauses.length === 0) {
    return selectAlertDefinitionById(input.alertDefinitionId, input.orgId);
  }

  setClauses.push("updated_at = now()");

  const rows = await query<AlertDefinitionRow>(
    `
      UPDATE analytics.alert_definitions
      SET ${setClauses.join(", ")}
      WHERE id = $1
        AND org_id = $2
      RETURNING
        id,
        org_id,
        key,
        name,
        description,
        severity,
        scope,
        condition_json,
        is_active,
        created_by,
        created_at,
        updated_at
    `,
    values,
  );

  return rows[0] ?? null;
}

export async function deleteAlertDefinition(
  alertDefinitionId: string,
  orgId: string,
): Promise<AlertDefinitionRow | null> {
  const rows = await query<AlertDefinitionRow>(
    `
      DELETE FROM analytics.alert_definitions
      WHERE id = $1
        AND org_id = $2
      RETURNING
        id,
        org_id,
        key,
        name,
        description,
        severity,
        scope,
        condition_json,
        is_active,
        created_by,
        created_at,
        updated_at
    `,
    [alertDefinitionId, orgId],
  );

  return rows[0] ?? null;
}
