import type { PoolClient } from "pg";

import { pool, query } from "../../../db/client.js";
import type {
  InventoryInventoryRow,
  InventoryMovementRow,
  InventoryMovementQuery,
  InventoryProductRow,
  InventorySummaryRow,
} from "../types/inventory.db.types.js";

export async function selectInventorySummariesByOwnerId(
  ownerId: string,
): Promise<InventorySummaryRow[]> {
  return query<InventorySummaryRow>(
    `
      SELECT
        p.id AS product_id,
        p.owner_id,
        p.name AS product_name,
        p.sku,
        p.unit_cost,
        COALESCE(i.quantity, 0) AS quantity,
        COALESCE(i.updated_at, p.updated_at) AS updated_at
      FROM inventory.products p
      LEFT JOIN inventory.inventory i ON i.product_id = p.id
      WHERE p.owner_id = $1 AND p.deleted_at IS NULL
      ORDER BY p.name ASC
    `,
    [ownerId],
  );
}

export async function selectInventorySummaryByProductId(
  productId: string,
  ownerId: string,
): Promise<InventorySummaryRow | null> {
  const rows = await query<InventorySummaryRow>(
    `
      SELECT
        p.id AS product_id,
        p.owner_id,
        p.name AS product_name,
        p.sku,
        p.unit_cost,
        COALESCE(i.quantity, 0) AS quantity,
        COALESCE(i.updated_at, p.updated_at) AS updated_at
      FROM inventory.products p
      LEFT JOIN inventory.inventory i ON i.product_id = p.id
      WHERE p.id = $1 AND p.owner_id = $2 AND p.deleted_at IS NULL
      LIMIT 1
    `,
    [productId, ownerId],
  );

  return rows[0] ?? null;
}

function buildStockMovementFilters(queryInput: InventoryMovementQuery): {
  whereClause: string;
  params: unknown[];
} {
  const conditions: string[] = ["owner_id = $1"];
  const params: unknown[] = [queryInput.ownerId];

  if (queryInput.productId) {
    params.push(queryInput.productId);
    conditions.push(`product_id = $${params.length}`);
  }

  if (queryInput.actorId) {
    params.push(queryInput.actorId);
    conditions.push(`actor_id = $${params.length}`);
  }

  if (queryInput.type) {
    params.push(queryInput.type);
    conditions.push(`type = $${params.length}`);
  }

  if (queryInput.createdFrom) {
    params.push(queryInput.createdFrom);
    conditions.push(`created_at >= $${params.length}`);
  }

  if (queryInput.createdTo) {
    params.push(queryInput.createdTo);
    conditions.push(`created_at <= $${params.length}`);
  }

  return {
    whereClause: conditions.join(" AND "),
    params,
  };
}

export async function selectStockMovementsByOwnerId(
  queryInput: InventoryMovementQuery,
): Promise<InventoryMovementRow[]> {
  const { whereClause, params } = buildStockMovementFilters(queryInput);
  const limitPlaceholder = params.length + 1;
  const offsetPlaceholder = params.length + 2;

  return query<InventoryMovementRow>(
    `
      SELECT
        sm.id,
        sm.owner_id,
        sm.actor_id,
        sm.product_id,
        sm.product_name,
        p.sku,
        a.name AS actor_name,
        a.email AS actor_email,
        a.username AS actor_username,
        sm.type,
        sm.quantity,
        sm.reason,
        sm.created_at
      FROM inventory.stock_movements sm
      LEFT JOIN inventory.products p
        ON p.id = sm.product_id
       AND p.owner_id = sm.owner_id
      LEFT JOIN auth.accounts a
        ON a.id = sm.actor_id
      WHERE ${whereClause.replaceAll("owner_id", "sm.owner_id").replaceAll("product_id", "sm.product_id").replaceAll("actor_id", "sm.actor_id").replaceAll("type", "sm.type").replaceAll("created_at", "sm.created_at")}
      ORDER BY sm.created_at DESC
      LIMIT $${limitPlaceholder}
      OFFSET $${offsetPlaceholder}
    `,
    [...params, queryInput.limit, queryInput.offset],
  );
}

export async function countStockMovementsByOwnerId(
  queryInput: Omit<InventoryMovementQuery, "limit" | "offset">,
): Promise<number> {
  const { whereClause, params } = buildStockMovementFilters({
    ...queryInput,
    limit: 0,
    offset: 0,
  });

  const rows = await query<{ count: string }>(
    `
      SELECT COUNT(*)::text AS count
      FROM inventory.stock_movements
      WHERE ${whereClause}
    `,
    params,
  );

  return Number(rows[0]?.count ?? "0");
}

export async function selectProductById(
  productId: string,
  ownerId: string,
): Promise<InventoryProductRow | null> {
  const rows = await query<InventoryProductRow>(
    `
      SELECT
        id,
        owner_id,
        name,
        description,
        sku,
        unit_cost,
        created_at,
        updated_at
      FROM inventory.products
      WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL
      LIMIT 1
    `,
    [productId, ownerId],
  );

  return rows[0] ?? null;
}

export async function selectInventoryRowByProductId(
  productId: string,
): Promise<InventoryInventoryRow | null> {
  const rows = await query<InventoryInventoryRow>(
    `
      SELECT
        product_id,
        quantity,
        created_at,
        updated_at
      FROM inventory.inventory
      WHERE product_id = $1
      LIMIT 1
    `,
    [productId],
  );

  return rows[0] ?? null;
}

export async function lockInventoryRow(
  client: PoolClient,
  productId: string,
): Promise<InventoryInventoryRow | null> {
  const result = await client.query<InventoryInventoryRow>(
    `
      SELECT
        product_id,
        quantity,
        created_at,
        updated_at
      FROM inventory.inventory
      WHERE product_id = $1
      FOR UPDATE
    `,
    [productId],
  );

  return result.rows[0] ?? null;
}

export async function insertInventoryRow(
  client: PoolClient,
  productId: string,
  quantity: number,
): Promise<InventoryInventoryRow> {
  const result = await client.query<InventoryInventoryRow>(
    `
      INSERT INTO inventory.inventory (product_id, quantity)
      VALUES ($1, $2)
      RETURNING product_id, quantity, created_at, updated_at
    `,
    [productId, quantity],
  );

  const row = result.rows[0];

  if (!row) {
    throw new Error("Failed to insert inventory row");
  }

  return row;
}

export async function updateInventoryRow(
  client: PoolClient,
  productId: string,
  quantity: number,
): Promise<InventoryInventoryRow> {
  const result = await client.query<InventoryInventoryRow>(
    `
      UPDATE inventory.inventory
      SET quantity = $2, updated_at = now()
      WHERE product_id = $1
      RETURNING product_id, quantity, created_at, updated_at
    `,
    [productId, quantity],
  );

  const row = result.rows[0];

  if (!row) {
    throw new Error("Failed to update inventory row");
  }

  return row;
}

export async function insertInventoryRowDirect(
  productId: string,
  quantity: number,
): Promise<InventoryInventoryRow> {
  const rows = await query<InventoryInventoryRow>(
    `
      INSERT INTO inventory.inventory (product_id, quantity)
      VALUES ($1, $2)
      RETURNING product_id, quantity, created_at, updated_at
    `,
    [productId, quantity],
  );

  const row = rows[0];

  if (!row) {
    throw new Error("Failed to insert inventory row");
  }

  return row;
}

export async function updateInventoryRowDirect(
  productId: string,
  quantity: number,
): Promise<InventoryInventoryRow | null> {
  const rows = await query<InventoryInventoryRow>(
    `
      UPDATE inventory.inventory
      SET quantity = $2, updated_at = now()
      WHERE product_id = $1
      RETURNING product_id, quantity, created_at, updated_at
    `,
    [productId, quantity],
  );

  return rows[0] ?? null;
}

export async function deleteInventoryRowDirect(
  productId: string,
): Promise<InventoryInventoryRow | null> {
  const rows = await query<InventoryInventoryRow>(
    `
      DELETE FROM inventory.inventory
      WHERE product_id = $1
      RETURNING product_id, quantity, created_at, updated_at
    `,
    [productId],
  );

  return rows[0] ?? null;
}

export type InsertStockMovementInput = {
  id: string;
  ownerId: string | null;
  actorId: string;
  productId: string;
  productName: string;
  type: string;
  quantity: number;
  reason?: string | null;
};

export async function insertStockMovement(
  client: PoolClient,
  input: InsertStockMovementInput,
): Promise<InventoryMovementRow> {
  const result = await client.query<InventoryMovementRow>(
    `
      INSERT INTO inventory.stock_movements
        (id, owner_id, actor_id, product_id, product_name, type, quantity, reason)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING
        id,
        owner_id,
        actor_id,
        product_id,
        product_name,
        type,
        quantity,
        reason,
        created_at
    `,
    [
      input.id,
      input.ownerId,
      input.actorId,
      input.productId,
      input.productName,
      input.type,
      input.quantity,
      input.reason ?? null,
    ],
  );

  const row = result.rows[0];

  if (!row) {
    throw new Error("Failed to insert stock movement");
  }

  return row;
}

export async function withTransaction<T>(
  task: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await task(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
