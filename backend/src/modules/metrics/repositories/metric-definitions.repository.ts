import { query } from "../../../db/client.js";
import type { MetricDefinitionRow } from "../types/metric-definition.types.js";

const metricDefinitionSelect = `
  SELECT
    id,
    org_id,
    key,
    name,
    description,
    scope,
    format,
    definition_json,
    is_active,
    created_by,
    created_at,
    updated_at
  FROM analytics.metric_definitions
`;

export async function listMetricDefinitionsByOrgId(
  orgId: string,
): Promise<MetricDefinitionRow[]> {
  return query<MetricDefinitionRow>(
    `
      ${metricDefinitionSelect}
      WHERE org_id = $1
      ORDER BY created_at DESC, name ASC
    `,
    [orgId],
  );
}

export async function selectMetricDefinitionById(
  metricId: string,
  orgId: string,
): Promise<MetricDefinitionRow | null> {
  const rows = await query<MetricDefinitionRow>(
    `
      ${metricDefinitionSelect}
      WHERE id = $1
        AND org_id = $2
      LIMIT 1
    `,
    [metricId, orgId],
  );

  return rows[0] ?? null;
}

export async function createMetricDefinition(
  input: {
    orgId: string;
    key: string;
    name: string;
    description?: string | null;
    scope: "organization" | "product" | "category";
    format: "number" | "percent" | "currency" | "quantity";
    definition: unknown;
    createdBy: string;
  },
): Promise<MetricDefinitionRow> {
  const rows = await query<MetricDefinitionRow>(
    `
      INSERT INTO analytics.metric_definitions (
        org_id,
        key,
        name,
        description,
        scope,
        format,
        definition_json,
        created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
      RETURNING
        id,
        org_id,
        key,
        name,
        description,
        scope,
        format,
        definition_json,
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
      input.scope,
      input.format,
      JSON.stringify(input.definition),
      input.createdBy,
    ],
  );

  const row = rows[0];

  if (!row) {
    throw new Error("Failed to create metric definition");
  }

  return row;
}

export async function updateMetricDefinition(input: {
  metricId: string;
  orgId: string;
  key?: string | undefined;
  name?: string | undefined;
  description?: string | null | undefined;
  scope?: "organization" | "product" | "category" | undefined;
  format?: "number" | "percent" | "currency" | "quantity" | undefined;
  definition?: unknown | undefined;
  isActive?: boolean | undefined;
}): Promise<MetricDefinitionRow | null> {
  const setClauses: string[] = [];
  const values: unknown[] = [input.metricId, input.orgId];

  if (input.key !== undefined) {
    values.push(input.key);
    setClauses.push(`key = $${values.length}`);
  }

  if (input.name !== undefined) {
    values.push(input.name);
    setClauses.push(`name = $${values.length}`);
  }

  if (input.description !== undefined) {
    values.push(input.description);
    setClauses.push(`description = $${values.length}`);
  }

  if (input.scope !== undefined) {
    values.push(input.scope);
    setClauses.push(`scope = $${values.length}`);
  }

  if (input.format !== undefined) {
    values.push(input.format);
    setClauses.push(`format = $${values.length}`);
  }

  if (input.definition !== undefined) {
    values.push(JSON.stringify(input.definition));
    setClauses.push(`definition_json = $${values.length}::jsonb`);
  }

  if (input.isActive !== undefined) {
    values.push(input.isActive);
    setClauses.push(`is_active = $${values.length}`);
  }

  if (setClauses.length === 0) {
    return selectMetricDefinitionById(input.metricId, input.orgId);
  }

  const rows = await query<MetricDefinitionRow>(
    `
      WITH updated AS (
        UPDATE analytics.metric_definitions
        SET ${setClauses.join(", ")},
            updated_at = now()
        WHERE id = $1
          AND org_id = $2
        RETURNING id
      )
      ${metricDefinitionSelect}
      WHERE id IN (SELECT id FROM updated)
      LIMIT 1
    `,
    values,
  );

  return rows[0] ?? null;
}

export async function deleteMetricDefinition(
  metricId: string,
  orgId: string,
): Promise<MetricDefinitionRow | null> {
  const rows = await query<MetricDefinitionRow>(
    `
      WITH deleted AS (
        DELETE FROM analytics.metric_definitions
        WHERE id = $1
          AND org_id = $2
        RETURNING
          id,
          org_id,
          key,
          name,
          description,
          scope,
          format,
          definition_json,
          is_active,
          created_by,
          created_at,
          updated_at
      )
      SELECT *
      FROM deleted
      LIMIT 1
    `,
    [metricId, orgId],
  );

  return rows[0] ?? null;
}

