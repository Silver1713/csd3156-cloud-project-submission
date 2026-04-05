import { query } from "../../../db/client.js";
import type {
  InventoryCategoryBreakdownRow,
  InventoryMovementTrendRow,
  InventoryMovementSummaryRow,
  InventoryOverviewRow,
} from "../types/metrics.db.types.js";

const CRITICAL_STOCK_THRESHOLD = 10;
const LOW_STOCK_THRESHOLD = 25;

export type MetricsFilterOptions = {
  q?: string;
  productId?: string;
  categoryIds?: string[];
  stockState?: "critical" | "low" | "healthy";
  criticalThreshold?: number;
  lowThreshold?: number;
};

function resolveThresholds(options: MetricsFilterOptions): {
  criticalThreshold: number;
  lowThreshold: number;
} {
  return {
    criticalThreshold: options.criticalThreshold ?? CRITICAL_STOCK_THRESHOLD,
    lowThreshold: options.lowThreshold ?? LOW_STOCK_THRESHOLD,
  };
}

function pushCommonProductFilters(
  conditions: string[],
  params: unknown[],
  options: MetricsFilterOptions,
): void {
  const { criticalThreshold, lowThreshold } = resolveThresholds(options);

  if (options.productId) {
    params.push(options.productId);
    conditions.push(`p.id = $${params.length}`);
  }

  if (options.categoryIds && options.categoryIds.length > 0) {
    params.push(options.categoryIds);
    conditions.push(`p.product_category_id = ANY($${params.length}::uuid[])`);
  }

  if (options.stockState) {
    if (options.stockState === "critical") {
      params.push(criticalThreshold);
      conditions.push(`COALESCE(i.quantity, 0) <= $${params.length}`);
    } else if (options.stockState === "low") {
      params.push(criticalThreshold, lowThreshold);
      conditions.push(
        `COALESCE(i.quantity, 0) > $${params.length - 1} AND COALESCE(i.quantity, 0) <= $${params.length}`,
      );
    } else {
      params.push(lowThreshold);
      conditions.push(`COALESCE(i.quantity, 0) > $${params.length}`);
    }
  }

  if (options.q) {
    params.push(`%${options.q.toLowerCase()}%`);
    conditions.push(
      `(LOWER(p.name) LIKE $${params.length} OR LOWER(COALESCE(p.sku, '')) LIKE $${params.length} OR LOWER(COALESCE(c.name, 'uncategorized')) LIKE $${params.length})`,
    );
  }
}

function buildProductMetricsFilters(
  ownerId: string,
  options: MetricsFilterOptions = {},
): { whereClause: string; params: unknown[] } {
  const params: unknown[] = [ownerId];
  const conditions = ["p.owner_id = $1", "p.deleted_at IS NULL"];

  pushCommonProductFilters(conditions, params, options);

  return {
    whereClause: conditions.join(" AND "),
    params,
  };
}

function buildMovementMetricsFilters(
  ownerId: string,
  options: MetricsFilterOptions & { days?: number } = {},
): { whereClause: string; params: unknown[] } {
  const { criticalThreshold, lowThreshold } = resolveThresholds(options);
  const params: unknown[] = [ownerId];
  const conditions = ["sm.owner_id = $1", "p.deleted_at IS NULL"];

  if (options.productId) {
    params.push(options.productId);
    conditions.push(`sm.product_id = $${params.length}`);
  }

  if (options.categoryIds && options.categoryIds.length > 0) {
    params.push(options.categoryIds);
    conditions.push(`p.product_category_id = ANY($${params.length}::uuid[])`);
  }

  if (options.stockState) {
    if (options.stockState === "critical") {
      params.push(criticalThreshold);
      conditions.push(`COALESCE(i.quantity, 0) <= $${params.length}`);
    } else if (options.stockState === "low") {
      params.push(criticalThreshold, lowThreshold);
      conditions.push(
        `COALESCE(i.quantity, 0) > $${params.length - 1} AND COALESCE(i.quantity, 0) <= $${params.length}`,
      );
    } else {
      params.push(lowThreshold);
      conditions.push(`COALESCE(i.quantity, 0) > $${params.length}`);
    }
  }

  if (options.q) {
    params.push(`%${options.q.toLowerCase()}%`);
    conditions.push(
      `(LOWER(p.name) LIKE $${params.length} OR LOWER(COALESCE(p.sku, '')) LIKE $${params.length} OR LOWER(COALESCE(c.name, 'uncategorized')) LIKE $${params.length})`,
    );
  }

  if (options.days) {
    params.push(options.days);
    conditions.push(`sm.created_at >= CURRENT_DATE - ($${params.length}::int - 1)`);
  }

  return {
    whereClause: conditions.join(" AND "),
    params,
  };
}

export async function selectInventoryOverviewByOwnerId(
  ownerId: string,
  options: MetricsFilterOptions = {},
): Promise<InventoryOverviewRow> {
  const { criticalThreshold, lowThreshold } = resolveThresholds(options);
  const { whereClause, params } = buildProductMetricsFilters(ownerId, options);

  const rows = await query<InventoryOverviewRow>(
    `
      SELECT
        COUNT(*)::text AS total_sku,
        COALESCE(SUM(COALESCE(i.quantity, 0)), 0)::text AS total_quantity,
        COALESCE(SUM(p.unit_cost * COALESCE(i.quantity, 0)), 0)::text AS total_value,
        COUNT(*) FILTER (WHERE COALESCE(i.quantity, 0) <= $${params.length + 1})::text AS critical_count,
        COUNT(*) FILTER (
          WHERE COALESCE(i.quantity, 0) > $${params.length + 1}
            AND COALESCE(i.quantity, 0) <= $${params.length + 2}
        )::text AS low_count
      FROM inventory.products p
      LEFT JOIN inventory.inventory i ON i.product_id = p.id
      LEFT JOIN inventory.categories c
        ON c.id = p.product_category_id
       AND c.org_id = p.owner_id
      WHERE ${whereClause}
    `,
    [...params, criticalThreshold, lowThreshold],
  );

  return (
    rows[0] ?? {
      total_sku: "0",
      total_quantity: "0",
      total_value: "0",
      critical_count: "0",
      low_count: "0",
    }
  );
}

export async function selectInventoryMovementTrendByOwnerId(
  ownerId: string,
  days: number,
  options: MetricsFilterOptions = {},
): Promise<InventoryMovementTrendRow[]> {
  const { whereClause, params } = buildMovementMetricsFilters(ownerId, {
    ...options,
    days,
  });

  return query<InventoryMovementTrendRow>(
    `
      WITH day_buckets AS (
        SELECT generate_series(
          CURRENT_DATE - (${params.length}::int - 1),
          CURRENT_DATE,
          INTERVAL '1 day'
        )::date AS bucket_date
      ),
      movement_rollup AS (
        SELECT
          DATE(sm.created_at) AS bucket_date,
          SUM(
            CASE
              WHEN sm.type IN ('STOCK_IN', 'TRANSFER_IN', 'ADJUSTMENT_INCREASE')
                THEN sm.quantity
              ELSE 0
            END
          )::text AS inbound_quantity,
          SUM(
            CASE
              WHEN sm.type IN ('STOCK_OUT', 'TRANSFER_OUT', 'ADJUSTMENT_DECREASE')
                THEN sm.quantity
              ELSE 0
            END
          )::text AS outbound_quantity
        FROM inventory.stock_movements sm
        LEFT JOIN inventory.products p
          ON p.id = sm.product_id
         AND p.owner_id = sm.owner_id
        LEFT JOIN inventory.inventory i
          ON i.product_id = p.id
        LEFT JOIN inventory.categories c
          ON c.id = p.product_category_id
         AND c.org_id = p.owner_id
        WHERE ${whereClause}
        GROUP BY DATE(sm.created_at)
      )
      SELECT
        db.bucket_date,
        COALESCE(mr.inbound_quantity, '0') AS inbound_quantity,
        COALESCE(mr.outbound_quantity, '0') AS outbound_quantity
      FROM day_buckets db
      LEFT JOIN movement_rollup mr ON mr.bucket_date = db.bucket_date
      ORDER BY db.bucket_date ASC
    `,
    params,
  );
}

export async function selectInventoryCategoryBreakdownByOwnerId(
  ownerId: string,
  options: MetricsFilterOptions = {},
): Promise<InventoryCategoryBreakdownRow[]> {
  const { whereClause, params } = buildProductMetricsFilters(ownerId, options);

  return query<InventoryCategoryBreakdownRow>(
    `
      SELECT
        c.id AS category_id,
        COALESCE(c.name, 'Uncategorized') AS category_name,
        COUNT(*)::text AS sku_count,
        COALESCE(SUM(COALESCE(i.quantity, 0)), 0)::text AS total_quantity,
        COALESCE(SUM(p.unit_cost * COALESCE(i.quantity, 0)), 0)::text AS total_value
      FROM inventory.products p
      LEFT JOIN inventory.inventory i ON i.product_id = p.id
      LEFT JOIN inventory.categories c
        ON c.id = p.product_category_id
       AND c.org_id = p.owner_id
      WHERE ${whereClause}
      GROUP BY c.id, c.name
      ORDER BY COALESCE(SUM(p.unit_cost * COALESCE(i.quantity, 0)), 0) DESC, COALESCE(c.name, 'Uncategorized') ASC
    `,
    params,
  );
}

export async function selectInventoryMovementSummaryByOwnerId(
  ownerId: string,
  options: MetricsFilterOptions & {
    days?: number;
  } = {},
): Promise<InventoryMovementSummaryRow> {
  const { whereClause, params } = buildMovementMetricsFilters(ownerId, options);

  const rows = await query<InventoryMovementSummaryRow>(
    `
      SELECT
        COUNT(*)::text AS movement_count,
        COALESCE(SUM(CASE WHEN sm.type = 'STOCK_IN' THEN sm.quantity ELSE 0 END), 0)::text AS stock_in_quantity,
        COALESCE(SUM(CASE WHEN sm.type = 'STOCK_OUT' THEN sm.quantity ELSE 0 END), 0)::text AS stock_out_quantity,
        COALESCE(SUM(CASE WHEN sm.type = 'TRANSFER_IN' THEN sm.quantity ELSE 0 END), 0)::text AS transfer_in_quantity,
        COALESCE(SUM(CASE WHEN sm.type = 'TRANSFER_OUT' THEN sm.quantity ELSE 0 END), 0)::text AS transfer_out_quantity,
        COALESCE(SUM(CASE WHEN sm.type = 'ADJUSTMENT_INCREASE' THEN sm.quantity ELSE 0 END), 0)::text AS adjustment_increase_quantity,
        COALESCE(SUM(CASE WHEN sm.type = 'ADJUSTMENT_DECREASE' THEN sm.quantity ELSE 0 END), 0)::text AS adjustment_decrease_quantity
      FROM inventory.stock_movements sm
      LEFT JOIN inventory.products p
        ON p.id = sm.product_id
       AND p.owner_id = sm.owner_id
      LEFT JOIN inventory.inventory i
        ON i.product_id = p.id
      LEFT JOIN inventory.categories c
        ON c.id = p.product_category_id
       AND c.org_id = p.owner_id
      WHERE ${whereClause}
    `,
    params,
  );

  return (
    rows[0] ?? {
      movement_count: "0",
      stock_in_quantity: "0",
      stock_out_quantity: "0",
      transfer_in_quantity: "0",
      transfer_out_quantity: "0",
      adjustment_increase_quantity: "0",
      adjustment_decrease_quantity: "0",
    }
  );
}
