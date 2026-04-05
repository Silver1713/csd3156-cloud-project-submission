/**
 * Implements inventory balance and movement workflows, including atomic stock
 * mutations and movement log pagination.
 */
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";

import {
  countStockMovementsByOwnerId,
  deleteInventoryRowDirect,
  insertInventoryRow,
  insertInventoryRowDirect,
  insertStockMovement,
  lockInventoryRow,
  selectInventoryRowByProductId,
  selectInventorySummariesByOwnerId,
  selectInventorySummaryByProductId,
  selectProductById,
  selectStockMovementsByOwnerId,
  updateInventoryRow,
  updateInventoryRowDirect,
  withTransaction,
} from "../repositories/inventory.repository.js";
import type {
  InventoryInventoryRow,
  InventoryMovementRow,
  InventoryProductRow,
  InventorySummaryRow,
} from "../types/inventory.db.types.js";
import {
  InsufficientStockError,
  InventoryAlreadyExistsError,
  InventoryNotFoundError,
  ProductNotFoundError,
  UnsupportedMovementTypeError,
} from "../types/inventory.errors.types.js";
import type { InventoryMovementType } from "../types/inventory.movement.types.js";
import { getMovementDeltaSign } from "../types/inventory.movement.types.js";
import type { CreateStockMovementDto } from "../dto/create-movement.dto.js";
import type { CreateInventoryAdjustmentDto } from "../dto/create-adjustment.dto.js";
import type { CreateInventoryDto } from "../dto/create-inventory.dto.js";
import type { UpdateInventoryDto } from "../dto/update-inventory.dto.js";
import type { ListStockMovementsQueryDto } from "../dto/list-stock-movements.dto.js";

type InventoryServiceDependencies = {
  selectInventorySummariesByOwnerId: (
    ownerId: string,
  ) => Promise<InventorySummaryRow[]>;
  selectInventorySummaryByProductId: (
    productId: string,
    ownerId: string,
  ) => Promise<InventorySummaryRow | null>;
  selectStockMovementsByOwnerId: (
    query: {
      ownerId: string;
      productId?: string;
      actorId?: string;
      type?: string;
      createdFrom?: Date;
      createdTo?: Date;
      limit: number;
      offset: number;
    },
  ) => Promise<InventoryMovementRow[]>;
  countStockMovementsByOwnerId: (query: {
    ownerId: string;
    productId?: string;
    actorId?: string;
    type?: string;
    createdFrom?: Date;
    createdTo?: Date;
  }) => Promise<number>;
  selectProductById: (
    productId: string,
    ownerId: string,
  ) => Promise<InventoryProductRow | null>;
  selectInventoryRowByProductId: (
    productId: string,
  ) => Promise<InventoryInventoryRow | null>;
  insertInventoryRowDirect: (
    productId: string,
    quantity: number,
  ) => Promise<InventoryInventoryRow>;
  updateInventoryRowDirect: (
    productId: string,
    quantity: number,
  ) => Promise<InventoryInventoryRow | null>;
  deleteInventoryRowDirect: (
    productId: string,
  ) => Promise<InventoryInventoryRow | null>;
  withTransaction: <T>(
    task: (client: PoolClient) => Promise<T>,
  ) => Promise<T>;
  lockInventoryRow: (
    client: PoolClient,
    productId: string,
  ) => Promise<InventoryInventoryRow | null>;
  updateInventoryRow: (
    client: PoolClient,
    productId: string,
    quantity: number,
  ) => Promise<InventoryInventoryRow>;
  insertInventoryRow: (
    client: PoolClient,
    productId: string,
    quantity: number,
  ) => Promise<InventoryInventoryRow>;
  insertStockMovement: (
    client: PoolClient,
    input: {
      id: string;
      ownerId: string | null;
      actorId: string;
      productId: string;
      productName: string;
      type: string;
      quantity: number;
      reason?: string | null;
    },
  ) => Promise<InventoryMovementRow>;
};

const inventoryServiceDependencies: InventoryServiceDependencies = {
  selectInventorySummariesByOwnerId,
  selectInventorySummaryByProductId,
  selectStockMovementsByOwnerId,
  countStockMovementsByOwnerId,
  selectProductById,
  selectInventoryRowByProductId,
  insertInventoryRowDirect,
  updateInventoryRowDirect,
  deleteInventoryRowDirect,
  withTransaction,
  lockInventoryRow,
  updateInventoryRow,
  insertInventoryRow,
  insertStockMovement,
};

export type InventorySummary = {
  productId: string;
  ownerId: string | null;
  productName: string;
  sku: string | null;
  unitCost: number;
  quantity: number;
  valuation: number;
  updatedAt: string;
};

export type StockMovement = {
  id: string;
  ownerId: string | null;
  actorId: string | null;
  productId: string | null;
  productName: string;
  sku: string | null;
  actorName: string | null;
  actorEmail: string | null;
  actorUsername: string | null;
  type: string;
  quantity: number;
  reason: string | null;
  createdAt: string;
};

export type RecordStockMovementResult = {
  movement: StockMovement;
  inventory: InventorySummary;
};

export type StockMovementListResult = {
  movements: StockMovement[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
};

function toMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function buildMovementQuery(
  ownerId: string,
  command: ListStockMovementsQueryDto,
): {
  ownerId: string;
  productId?: string;
  actorId?: string;
  type?: string;
  createdFrom?: Date;
  createdTo?: Date;
  limit: number;
  offset: number;
} {
  return {
    ownerId,
    ...(command.productId ? { productId: command.productId } : {}),
    ...(command.actorId ? { actorId: command.actorId } : {}),
    ...(command.type ? { type: command.type } : {}),
    ...(command.createdFrom ? { createdFrom: command.createdFrom } : {}),
    ...(command.createdTo ? { createdTo: command.createdTo } : {}),
    limit: command.limit,
    offset: command.offset,
  };
}

function buildMovementCountQuery(
  ownerId: string,
  command: ListStockMovementsQueryDto,
): {
  ownerId: string;
  productId?: string;
  actorId?: string;
  type?: string;
  createdFrom?: Date;
  createdTo?: Date;
} {
  return {
    ownerId,
    ...(command.productId ? { productId: command.productId } : {}),
    ...(command.actorId ? { actorId: command.actorId } : {}),
    ...(command.type ? { type: command.type } : {}),
    ...(command.createdFrom ? { createdFrom: command.createdFrom } : {}),
    ...(command.createdTo ? { createdTo: command.createdTo } : {}),
  };
}

/**
 * Lists the current inventory snapshot for every stocked product in an
 * organization.
 */
export async function listInventorySummaries(
  ownerId: string,
  dependencies: InventoryServiceDependencies = inventoryServiceDependencies,
): Promise<InventorySummary[]> {
  const rows = await dependencies.selectInventorySummariesByOwnerId(ownerId);
  return rows.map(mapSummaryRow);
}

/**
 * Returns the current balance and valuation for a single product.
 */
export async function getInventorySummaryByProductId(
  productId: string,
  ownerId: string,
  dependencies: InventoryServiceDependencies = inventoryServiceDependencies,
): Promise<InventorySummary> {
  const row = await dependencies.selectInventorySummaryByProductId(
    productId,
    ownerId,
  );

  if (!row) {
    throw new ProductNotFoundError();
  }

  return mapSummaryRow(row);
}

/**
 * Returns movement history with pagination and server-side filters.
 */
export async function listStockMovements(
  ownerId: string,
  command: ListStockMovementsQueryDto,
  dependencies: InventoryServiceDependencies = inventoryServiceDependencies,
): Promise<StockMovementListResult> {
  const query = buildMovementQuery(ownerId, command);
  const [rows, total] = await Promise.all([
    dependencies.selectStockMovementsByOwnerId(query),
    dependencies.countStockMovementsByOwnerId(buildMovementCountQuery(ownerId, command)),
  ]);

  const movements = rows.map(mapMovementRow);

  return {
    movements,
    pagination: {
      limit: command.limit,
      offset: command.offset,
      total,
      hasMore: command.offset + movements.length < total,
    },
  };
}

/**
 * Creates an inventory row for a product that does not yet have tracked stock.
 */
export async function createInventoryBalance(
  ownerId: string,
  command: CreateInventoryDto,
  dependencies: InventoryServiceDependencies = inventoryServiceDependencies,
): Promise<{ inventory: InventorySummary }> {
  const product = await dependencies.selectProductById(command.productId, ownerId);

  if (!product) {
    throw new ProductNotFoundError();
  }

  const existingInventory = await dependencies.selectInventoryRowByProductId(
    command.productId,
  );

  if (existingInventory) {
    throw new InventoryAlreadyExistsError();
  }

  const inventoryRow = await dependencies.insertInventoryRowDirect(
    command.productId,
    command.quantity,
  );

  return {
    inventory: mapInventorySnapshot(inventoryRow, product),
  };
}

/**
 * Overwrites an existing inventory balance with a direct quantity update.
 */
export async function updateInventoryBalance(
  productId: string,
  ownerId: string,
  command: UpdateInventoryDto,
  dependencies: InventoryServiceDependencies = inventoryServiceDependencies,
): Promise<{ inventory: InventorySummary }> {
  const product = await dependencies.selectProductById(productId, ownerId);

  if (!product) {
    throw new ProductNotFoundError();
  }

  const inventoryRow = await dependencies.updateInventoryRowDirect(
    productId,
    command.quantity,
  );

  if (!inventoryRow) {
    throw new InventoryNotFoundError();
  }

  return {
    inventory: mapInventorySnapshot(inventoryRow, product),
  };
}

/**
 * Removes an inventory balance row entirely.
 */
export async function deleteInventoryBalance(
  productId: string,
  ownerId: string,
  dependencies: InventoryServiceDependencies = inventoryServiceDependencies,
): Promise<{ inventory: InventorySummary }> {
  const product = await dependencies.selectProductById(productId, ownerId);

  if (!product) {
    throw new ProductNotFoundError();
  }

  const inventoryRow = await dependencies.deleteInventoryRowDirect(productId);

  if (!inventoryRow) {
    throw new InventoryNotFoundError();
  }

  return {
    inventory: mapInventorySnapshot(inventoryRow, product),
  };
}

/**
 * Records a stock movement and updates the underlying balance in the same
 * transaction to keep quantity and audit history consistent.
 */
export async function recordStockMovement(
  ownerId: string,
  actorId: string,
  command: CreateStockMovementDto,
  dependencies: InventoryServiceDependencies = inventoryServiceDependencies,
): Promise<RecordStockMovementResult> {
  const product = await dependencies.selectProductById(command.productId, ownerId);

  if (!product) {
    throw new ProductNotFoundError();
  }

  let deltaSign: 1 | -1;

  try {
    deltaSign = getMovementDeltaSign(command.type as InventoryMovementType);
  } catch {
    throw new UnsupportedMovementTypeError();
  }

  const delta = deltaSign * command.quantity;

  const { inventoryRow, movementRow } = await dependencies.withTransaction(
    async (client) => {
      const existingInventory = await dependencies.lockInventoryRow(
        client,
        command.productId,
      );
    const currentQuantity = existingInventory?.quantity ?? 0;
    const nextQuantity = currentQuantity + delta;

    if (nextQuantity < 0) {
      throw new InsufficientStockError();
    }

    const updatedInventory = existingInventory
      ? await dependencies.updateInventoryRow(client, command.productId, nextQuantity)
      : await dependencies.insertInventoryRow(client, command.productId, nextQuantity);

    const movementId = randomUUID();

      const movement = await dependencies.insertStockMovement(client, {
        id: movementId,
        ownerId: product.owner_id,
        actorId,
        productId: command.productId,
        productName: product.name,
        type: command.type,
        quantity: command.quantity,
        reason: command.reason ?? null,
      });

      return {
        inventoryRow: updatedInventory,
        movementRow: movement,
      };
    },
  );

  return {
    movement: mapMovementRow(movementRow),
    inventory: mapInventorySnapshot(inventoryRow, product),
  };
}

/**
 * Records an explicit adjustment event while preserving the same transactional
 * guarantees as standard stock movements.
 */
export async function recordInventoryAdjustment(
  ownerId: string,
  actorId: string,
  command: CreateInventoryAdjustmentDto,
  dependencies: InventoryServiceDependencies = inventoryServiceDependencies,
): Promise<RecordStockMovementResult> {
  return recordStockMovement(
    ownerId,
    actorId,
    {
      productId: command.productId,
      type:
        command.direction === "increase"
          ? "ADJUSTMENT_INCREASE"
          : "ADJUSTMENT_DECREASE",
      quantity: command.quantity,
      reason: command.reason,
    },
    dependencies,
  );
}

function mapSummaryRow(row: InventorySummaryRow): InventorySummary {
  const unitCost = Number(row.unit_cost);

  return {
    productId: row.product_id,
    ownerId: row.owner_id,
    productName: row.product_name,
    sku: row.sku,
    unitCost,
    quantity: row.quantity,
    valuation: toMoney(unitCost * row.quantity),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapMovementRow(row: InventoryMovementRow): StockMovement {
  return {
    id: row.id,
    ownerId: row.owner_id,
    actorId: row.actor_id,
    productId: row.product_id,
    productName: row.product_name,
    sku: row.sku ?? null,
    actorName: row.actor_name ?? null,
    actorEmail: row.actor_email ?? null,
    actorUsername: row.actor_username ?? null,
    type: row.type,
    quantity: row.quantity,
    reason: row.reason ?? null,
    createdAt: row.created_at.toISOString(),
  };
}

function mapInventorySnapshot(
  row: InventoryInventoryRow,
  product: InventoryProductRow,
): InventorySummary {
  const unitCost = Number(product.unit_cost);

  return {
    productId: row.product_id,
    ownerId: product.owner_id,
    productName: product.name,
    sku: product.sku,
    unitCost,
    quantity: row.quantity,
    valuation: toMoney(unitCost * row.quantity),
    updatedAt: row.updated_at.toISOString(),
  };
}
