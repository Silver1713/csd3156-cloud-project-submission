import { query } from "../../../db/client.js";
import type { AlertListQuery, AlertRow } from "../types/alerts.db.types.js";

function buildAlertSelectSql(whereClause: string): string {
  return `
    SELECT
      a.id,
      a.owner_id,
      a.product_id,
      a.triggered_by_movement_id,
      a.alert_definition_id,
      a.type,
      a.status,
      a.threshold_quantity,
      a.current_quantity,
      a.message,
      a.acknowledged_by,
      a.acknowledged_at,
      a.created_at,
      p.name AS product_name,
      p.sku AS product_sku,
      ack.name AS acknowledged_by_name,
      ack.username AS acknowledged_by_username
    FROM inventory.alerts a
    LEFT JOIN inventory.products p ON p.id = a.product_id
    LEFT JOIN auth.accounts ack ON ack.id = a.acknowledged_by
    ${whereClause}
  `;
}

function buildAlertFilter(
  queryInput: Omit<AlertListQuery, "limit" | "offset">,
): { whereClause: string; params: unknown[] } {
  const clauses = ["a.owner_id = $1"];
  const params: unknown[] = [queryInput.ownerId];

  if (queryInput.status) {
    params.push(queryInput.status);
    clauses.push(`a.status = $${params.length}`);
  }

  if (queryInput.type) {
    params.push(queryInput.type);
    clauses.push(`a.type = $${params.length}`);
  }

  if (queryInput.productId) {
    params.push(queryInput.productId);
    clauses.push(`a.product_id = $${params.length}`);
  }

  return {
    whereClause: `WHERE ${clauses.join(" AND ")}`,
    params,
  };
}

export async function selectAlertsByOwnerId(
  queryInput: AlertListQuery,
): Promise<AlertRow[]> {
  const { whereClause, params } = buildAlertFilter(queryInput);

  return query<AlertRow>(
    `
      ${buildAlertSelectSql(whereClause)}
      ORDER BY a.created_at DESC
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2}
    `,
    [...params, queryInput.limit, queryInput.offset],
  );
}

export async function countAlertsByOwnerId(
  queryInput: Omit<AlertListQuery, "limit" | "offset">,
): Promise<number> {
  const { whereClause, params } = buildAlertFilter(queryInput);
  const rows = await query<{ total: string }>(
    `
      SELECT COUNT(*)::text AS total
      FROM inventory.alerts a
      ${whereClause}
    `,
    params,
  );

  return Number(rows[0]?.total ?? 0);
}

export async function selectAlertById(
  alertId: string,
  ownerId: string,
): Promise<AlertRow | null> {
  const rows = await query<AlertRow>(
    `
      ${buildAlertSelectSql("WHERE a.id = $1 AND a.owner_id = $2")}
      LIMIT 1
    `,
    [alertId, ownerId],
  );

  return rows[0] ?? null;
}

export async function insertAlert(input: {
  ownerId: string;
  productId?: string | null;
  triggeredByMovementId?: string | null;
  alertDefinitionId?: string | null;
  type: string;
  status: string;
  thresholdQuantity?: number | null;
  currentQuantity?: number | null;
  message?: string | null;
}): Promise<AlertRow> {
  const rows = await query<AlertRow>(
    `
      INSERT INTO inventory.alerts (
        owner_id,
        product_id,
        triggered_by_movement_id,
        alert_definition_id,
        type,
        status,
        threshold_quantity,
        current_quantity,
        message
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING
        id,
        owner_id,
        product_id,
        triggered_by_movement_id,
        alert_definition_id,
        type,
        status,
        threshold_quantity,
        current_quantity,
        message,
        acknowledged_by,
        acknowledged_at,
        created_at,
        (
          SELECT p.name
          FROM inventory.products p
          WHERE p.id = inventory.alerts.product_id
        ) AS product_name,
        (
          SELECT p.sku
          FROM inventory.products p
          WHERE p.id = inventory.alerts.product_id
        ) AS product_sku,
        NULL::text AS acknowledged_by_name,
        NULL::text AS acknowledged_by_username
    `,
    [
      input.ownerId,
      input.productId ?? null,
      input.triggeredByMovementId ?? null,
      input.alertDefinitionId ?? null,
      input.type,
      input.status,
      input.thresholdQuantity ?? null,
      input.currentQuantity ?? null,
      input.message ?? null,
    ],
  );

  const alert = rows[0];

  if (!alert) {
    throw new Error("Failed to create alert");
  }

  return alert;
}

export async function updateAlert(input: {
  alertId: string;
  ownerId: string;
  status?: string | undefined;
  thresholdQuantity?: number | null | undefined;
  currentQuantity?: number | null | undefined;
  message?: string | null | undefined;
  acknowledgedBy?: string | null;
}): Promise<AlertRow | null> {
  const setClauses: string[] = [];
  const values: unknown[] = [input.alertId, input.ownerId];

  if (input.status !== undefined) {
    values.push(input.status);
    setClauses.push(`status = $${values.length}`);

    if (input.status === "acknowledged" && input.acknowledgedBy) {
      values.push(input.acknowledgedBy);
      setClauses.push(`acknowledged_by = $${values.length}`);
      setClauses.push("acknowledged_at = now()");
    }
  }

  if (input.thresholdQuantity !== undefined) {
    values.push(input.thresholdQuantity);
    setClauses.push(`threshold_quantity = $${values.length}`);
  }

  if (input.currentQuantity !== undefined) {
    values.push(input.currentQuantity);
    setClauses.push(`current_quantity = $${values.length}`);
  }

  if (input.message !== undefined) {
    values.push(input.message);
    setClauses.push(`message = $${values.length}`);
  }

  if (setClauses.length === 0) {
    return selectAlertById(input.alertId, input.ownerId);
  }

  const rows = await query<AlertRow>(
    `
      WITH updated AS (
        UPDATE inventory.alerts
        SET ${setClauses.join(", ")}
        WHERE id = $1
          AND owner_id = $2
        RETURNING id
      )
      ${buildAlertSelectSql("WHERE a.id IN (SELECT id FROM updated)")}
      LIMIT 1
    `,
    values,
  );

  return rows[0] ?? null;
}

export async function deleteAlert(
  alertId: string,
  ownerId: string,
): Promise<AlertRow | null> {
  const rows = await query<AlertRow>(
    `
      WITH deleted AS (
        DELETE FROM inventory.alerts
        WHERE id = $1
          AND owner_id = $2
        RETURNING
          id,
          owner_id,
          product_id,
          triggered_by_movement_id,
          alert_definition_id,
          type,
          status,
          threshold_quantity,
          current_quantity,
          message,
          acknowledged_by,
          acknowledged_at,
          created_at
      )
      SELECT
        d.id,
        d.owner_id,
        d.product_id,
        d.triggered_by_movement_id,
        d.alert_definition_id,
        d.type,
        d.status,
        d.threshold_quantity,
        d.current_quantity,
        d.message,
        d.acknowledged_by,
        d.acknowledged_at,
        d.created_at,
        p.name AS product_name,
        p.sku AS product_sku,
        ack.name AS acknowledged_by_name,
        ack.username AS acknowledged_by_username
      FROM deleted d
      LEFT JOIN inventory.products p ON p.id = d.product_id
      LEFT JOIN auth.accounts ack ON ack.id = d.acknowledged_by
      LIMIT 1
    `,
    [alertId, ownerId],
  );

  return rows[0] ?? null;
}

export async function selectOpenAlertByDefinitionId(
  ownerId: string,
  alertDefinitionId: string,
): Promise<AlertRow | null> {
  const rows = await query<AlertRow>(
    `
      ${buildAlertSelectSql(
        "WHERE a.owner_id = $1 AND a.alert_definition_id = $2 AND a.status <> 'resolved'",
      )}
      ORDER BY a.created_at DESC
      LIMIT 1
    `,
    [ownerId, alertDefinitionId],
  );

  return rows[0] ?? null;
}
