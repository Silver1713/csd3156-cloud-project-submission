import assert from "node:assert/strict";
import test from "node:test";
import type { PoolClient } from "pg";

import {
  createInventoryBalance,
  deleteInventoryBalance,
  getInventorySummaryByProductId,
  listInventorySummaries,
  listStockMovements,
  recordInventoryAdjustment,
  recordStockMovement,
  updateInventoryBalance,
} from "../services/inventory.service.js";
import {
  InsufficientStockError,
  InventoryAlreadyExistsError,
  InventoryNotFoundError,
  ProductNotFoundError,
} from "../types/inventory.errors.types.js";

const ownerId = "11111111-1111-1111-1111-111111111111";
const productId = "22222222-2222-2222-2222-222222222222";
const actorId = "33333333-3333-3333-3333-333333333333";

const sampleProductRow = {
  id: productId,
  owner_id: ownerId,
  name: "Widget",
  description: "Useful widget",
  sku: "WGT-001",
  unit_cost: "19.99",
  created_at: new Date("2026-03-29T00:00:00.000Z"),
  updated_at: new Date("2026-03-29T00:00:00.000Z"),
};

const sampleInventoryRow = {
  product_id: productId,
  quantity: 10,
  created_at: new Date("2026-03-29T00:00:00.000Z"),
  updated_at: new Date("2026-03-29T00:00:00.000Z"),
};

const sampleSummaryRow = {
  product_id: productId,
  owner_id: ownerId,
  product_name: "Widget",
  sku: "WGT-001",
  unit_cost: "19.99",
  quantity: 10,
  updated_at: new Date("2026-03-29T00:00:00.000Z"),
};

const sampleMovementRow = {
  id: "44444444-4444-4444-4444-444444444444",
  owner_id: ownerId,
  actor_id: actorId,
  product_id: productId,
  product_name: "Widget",
  type: "STOCK_IN",
  quantity: 5,
  reason: "Initial inbound receipt",
  created_at: new Date("2026-03-29T00:00:00.000Z"),
};

function createDeps(overrides: Record<string, unknown> = {}) {
  return {
    selectInventorySummariesByOwnerId: async (_ownerId: string) => [sampleSummaryRow],
    selectInventorySummaryByProductId: async (
      _productId: string,
      _ownerId: string,
    ) => sampleSummaryRow,
    selectStockMovementsByOwnerId: async () => [sampleMovementRow],
    countStockMovementsByOwnerId: async () => 1,
    selectProductById: async (_productId: string, _ownerId: string) =>
      sampleProductRow,
    selectInventoryRowByProductId: async (_productId: string) => null,
    insertInventoryRowDirect: async (_productId: string, quantity: number) => ({
      ...sampleInventoryRow,
      quantity,
    }),
    updateInventoryRowDirect: async (_productId: string, quantity: number) => ({
      ...sampleInventoryRow,
      quantity,
    }),
    deleteInventoryRowDirect: async (_productId: string) => sampleInventoryRow,
    withTransaction: async <T>(task: (client: PoolClient) => Promise<T>) =>
      task({} as PoolClient),
    lockInventoryRow: async (_client: PoolClient, _productId: string) =>
      sampleInventoryRow,
    updateInventoryRow: async (
      _client: PoolClient,
      _productId: string,
      quantity: number,
    ) => ({
      ...sampleInventoryRow,
      quantity,
    }),
    insertInventoryRow: async (
      _client: PoolClient,
      _productId: string,
      quantity: number,
    ) => ({
      ...sampleInventoryRow,
      quantity,
    }),
    insertStockMovement: async (
      _client: PoolClient,
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
    ) => ({
      ...sampleMovementRow,
      id: input.id,
      owner_id: input.ownerId,
      actor_id: input.actorId,
      product_id: input.productId,
      product_name: input.productName,
      type: input.type,
      quantity: input.quantity,
      reason: input.reason ?? null,
    }),
    ...overrides,
  };
}

test("listInventorySummaries scopes repository access by organization owner id", async () => {
  let capturedOwnerId: string | null = null;

  const result = await listInventorySummaries(
    ownerId,
    createDeps({
      selectInventorySummariesByOwnerId: async (receivedOwnerId: string) => {
        capturedOwnerId = receivedOwnerId;
        return [sampleSummaryRow];
      },
    }),
  );

  assert.equal(capturedOwnerId, ownerId);
  assert.equal(result.length, 1);
  assert.equal(result[0]?.ownerId, ownerId);
  assert.equal(result[0]?.unitCost, 19.99);
  assert.equal(result[0]?.valuation, 199.9);
});

test("getInventorySummaryByProductId throws when the product is outside the organization scope", async () => {
  await assert.rejects(
    () =>
      getInventorySummaryByProductId(
        productId,
        ownerId,
        createDeps({
          selectInventorySummaryByProductId: async () => null,
        }),
      ),
    ProductNotFoundError,
  );
});

test("createInventoryBalance rejects creating a second inventory row for the same product", async () => {
  await assert.rejects(
    () =>
      createInventoryBalance(
        ownerId,
        {
          productId,
          quantity: 10,
        },
        createDeps({
          selectInventoryRowByProductId: async () => sampleInventoryRow,
        }),
      ),
    InventoryAlreadyExistsError,
  );
});

test("createInventoryBalance creates inventory only for a product in the current organization scope", async () => {
  let capturedProductId: string | null = null;
  let capturedQuantity: number | null = null;

  const result = await createInventoryBalance(
    ownerId,
    {
      productId,
      quantity: 12,
    },
    createDeps({
      insertInventoryRowDirect: async (receivedProductId: string, quantity: number) => {
        capturedProductId = receivedProductId;
        capturedQuantity = quantity;
        return {
          ...sampleInventoryRow,
          product_id: receivedProductId,
          quantity,
        };
      },
    }),
  );

  assert.equal(capturedProductId, productId);
  assert.equal(capturedQuantity, 12);
  assert.equal(result.inventory.ownerId, ownerId);
  assert.equal(result.inventory.productId, productId);
  assert.equal(result.inventory.unitCost, 19.99);
  assert.equal(result.inventory.valuation, 239.88);
});

test("updateInventoryBalance preserves organization scope through product lookup", async () => {
  let capturedOwnerId: string | null = null;

  const result = await updateInventoryBalance(
    productId,
    ownerId,
    {
      quantity: 7,
    },
    createDeps({
      selectProductById: async (_productId: string, receivedOwnerId: string) => {
        capturedOwnerId = receivedOwnerId;
        return sampleProductRow;
      },
    }),
  );

  assert.equal(capturedOwnerId, ownerId);
  assert.equal(result.inventory.quantity, 7);
  assert.equal(result.inventory.valuation, 139.93);
});

test("deleteInventoryBalance throws when no inventory row exists for the scoped product", async () => {
  await assert.rejects(
    () =>
      deleteInventoryBalance(
        productId,
        ownerId,
        createDeps({
          deleteInventoryRowDirect: async () => null,
        }),
      ),
    InventoryNotFoundError,
  );
});

test("listStockMovements scopes repository access by organization owner id and limit", async () => {
  let capturedQuery:
    | {
        ownerId: string;
        productId?: string;
        actorId?: string;
        type?: string;
        createdFrom?: Date;
        createdTo?: Date;
        limit: number;
        offset: number;
      }
    | null = null;

  const result = await listStockMovements(
    ownerId,
    {
      limit: 25,
      offset: 10,
      productId,
      actorId,
      type: "STOCK_IN",
    },
    createDeps({
      selectStockMovementsByOwnerId: async (receivedQuery: {
        ownerId: string;
        productId?: string;
        actorId?: string;
        type?: string;
        createdFrom?: Date;
        createdTo?: Date;
        limit: number;
        offset: number;
      }) => {
        capturedQuery = receivedQuery;
        return [sampleMovementRow];
      },
      countStockMovementsByOwnerId: async () => 1,
    }),
  );

  assert.deepEqual(capturedQuery, {
    ownerId,
    productId,
    actorId,
    type: "STOCK_IN",
    limit: 25,
    offset: 10,
  });
  assert.equal(result.movements[0]?.ownerId, ownerId);
  assert.equal(result.movements[0]?.reason, "Initial inbound receipt");
  assert.equal(result.pagination.total, 1);
  assert.equal(result.pagination.hasMore, false);
});

test("recordStockMovement uses authenticated actor and organization-scoped product ownership", async () => {
  let capturedMovementInput:
    | {
        ownerId: string | null;
        actorId: string;
        productId: string;
        productName: string;
        type: string;
        quantity: number;
        reason?: string | null;
      }
    | null = null;

  const result = await recordStockMovement(
    ownerId,
    actorId,
    {
      productId,
      type: "STOCK_IN",
      quantity: 5,
      reason: undefined,
    },
    createDeps({
      insertStockMovement: async (
        _client: PoolClient,
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
      ) => {
        capturedMovementInput = {
          ownerId: input.ownerId,
          actorId: input.actorId,
          productId: input.productId,
          productName: input.productName,
          type: input.type,
          quantity: input.quantity,
          reason: input.reason ?? null,
        };

        return {
          ...sampleMovementRow,
          id: input.id,
          owner_id: input.ownerId,
          actor_id: input.actorId,
          product_id: input.productId,
          product_name: input.productName,
          type: input.type,
          quantity: input.quantity,
          reason: input.reason ?? null,
        };
      },
    }),
  );

  assert.deepEqual(capturedMovementInput, {
    ownerId,
    actorId,
    productId,
    productName: "Widget",
    type: "STOCK_IN",
    quantity: 5,
    reason: null,
  });
  assert.equal(result.inventory.ownerId, ownerId);
  assert.equal(result.inventory.unitCost, 19.99);
  assert.equal(result.inventory.valuation, 299.85);
  assert.equal(result.movement.actorId, actorId);
  assert.equal(result.movement.reason, null);
});

test("recordStockMovement rejects stock-out below zero", async () => {
  await assert.rejects(
    () =>
      recordStockMovement(
        ownerId,
        actorId,
        {
          productId,
          type: "STOCK_OUT",
          quantity: 11,
          reason: "Attempted overshipment",
        },
        createDeps({
          lockInventoryRow: async () => sampleInventoryRow,
        }),
      ),
    InsufficientStockError,
  );
});

test("recordInventoryAdjustment derives adjustment movement types in the service", async () => {
  let capturedMovementInput:
    | {
        ownerId: string | null;
        actorId: string;
        productId: string;
        productName: string;
        type: string;
        quantity: number;
        reason?: string | null;
      }
    | null = null;

  const result = await recordInventoryAdjustment(
    ownerId,
    actorId,
    {
      productId,
      direction: "decrease",
      quantity: 2,
      reason: "Cycle count reconciliation",
    },
    createDeps({
      insertStockMovement: async (
        _client: PoolClient,
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
      ) => {
        capturedMovementInput = {
          ownerId: input.ownerId,
          actorId: input.actorId,
          productId: input.productId,
          productName: input.productName,
          type: input.type,
          quantity: input.quantity,
          reason: input.reason ?? null,
        };

        return {
          ...sampleMovementRow,
          id: input.id,
          owner_id: input.ownerId,
          actor_id: input.actorId,
          product_id: input.productId,
          product_name: input.productName,
          type: input.type,
          quantity: input.quantity,
          reason: input.reason ?? null,
        };
      },
    }),
  );

  assert.deepEqual(capturedMovementInput, {
    ownerId,
    actorId,
    productId,
    productName: "Widget",
    type: "ADJUSTMENT_DECREASE",
    quantity: 2,
    reason: "Cycle count reconciliation",
  });
  assert.equal(result.movement.type, "ADJUSTMENT_DECREASE");
  assert.equal(result.movement.reason, "Cycle count reconciliation");
  assert.equal(result.inventory.quantity, 8);
});
