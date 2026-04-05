import assert from "node:assert/strict";
import test from "node:test";

import {
  getInventoryCategoryBreakdownMetrics,
  getInventoryMovementSummaryMetrics,
  getInventoryMovementTrendMetrics,
  getInventoryOverviewMetrics,
} from "../services/metrics.service.js";

const ownerId = "11111111-1111-1111-1111-111111111111";

function createDeps(overrides: Record<string, unknown> = {}) {
  return {
    createMetricDefinition: async () => {
      throw new Error("not used");
    },
    listMetricDefinitionsByOrgId: async () => [],
    selectMetricDefinitionById: async () => null,
    updateMetricDefinition: async () => {
      throw new Error("not used");
    },
    deleteMetricDefinition: async () => {
      throw new Error("not used");
    },
    findOrganizationById: async () => ({
      id: ownerId,
      name: "Current Org",
      critical_stock_threshold: 10,
      low_stock_threshold: 25,
    }),
    selectInventoryOverviewByOwnerId: async () => ({
      total_sku: "3",
      total_quantity: "120",
      total_value: "1890.40",
      critical_count: "1",
      low_count: "1",
    }),
    selectInventoryMovementTrendByOwnerId: async () => [
      {
        bucket_date: new Date("2026-04-01T00:00:00.000Z"),
        inbound_quantity: "55",
        outbound_quantity: "13",
      },
      {
        bucket_date: new Date("2026-04-02T00:00:00.000Z"),
        inbound_quantity: "0",
        outbound_quantity: "4",
      },
    ],
    selectInventoryMovementSummaryByOwnerId: async () => ({
      movement_count: "9",
      stock_in_quantity: "100",
      stock_out_quantity: "50",
      transfer_in_quantity: "12",
      transfer_out_quantity: "6",
      adjustment_increase_quantity: "4",
      adjustment_decrease_quantity: "2",
    }),
    selectInventoryCategoryBreakdownByOwnerId: async () => [
      {
        category_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        category_name: "Technology",
        sku_count: "2",
        total_quantity: "900",
        total_value: "1890000",
      },
      {
        category_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        category_name: "Art Supplies",
        sku_count: "1",
        total_quantity: "450000",
        total_value: "1609965",
      },
      {
        category_id: null,
        category_name: "Uncategorized",
        sku_count: "1",
        total_quantity: "3",
        total_value: "24",
      },
    ],
    ...overrides,
  };
}

test("getInventoryOverviewMetrics maps aggregated overview values", async () => {
  const result = await getInventoryOverviewMetrics(ownerId, {}, createDeps());

  assert.deepEqual(result, {
    totalSku: 3,
    totalQuantity: 120,
    totalValue: 1890.4,
    criticalCount: 1,
    lowCount: 1,
  });
});

test("getInventoryMovementTrendMetrics maps day buckets and quantities", async () => {
  const result = await getInventoryMovementTrendMetrics(
    ownerId,
    7,
    {},
    createDeps(),
  );

  assert.equal(result.days, 7);
  assert.deepEqual(result.trend, [
    {
      bucket: "2026-04-01",
      inbound: 55,
      outbound: 13,
    },
    {
      bucket: "2026-04-02",
      inbound: 0,
      outbound: 4,
    },
  ]);
});

test("getInventoryOverviewMetrics uses stored organization thresholds when query overrides are absent", async () => {
  let capturedOptions:
    | { criticalThreshold?: number; lowThreshold?: number }
    | undefined;

  await getInventoryOverviewMetrics(
    ownerId,
    {},
    createDeps({
      findOrganizationById: async () => ({
        id: ownerId,
        name: "Configured Org",
        critical_stock_threshold: 5,
        low_stock_threshold: 12,
      }),
      selectInventoryOverviewByOwnerId: async (
        _ownerId: string,
        options?: { criticalThreshold?: number; lowThreshold?: number },
      ) => {
        capturedOptions = options;
        return {
          total_sku: "3",
          total_quantity: "120",
          total_value: "1890.40",
          critical_count: "1",
          low_count: "1",
        };
      },
    }),
  );

  assert.deepEqual(capturedOptions, {
    criticalThreshold: 5,
    lowThreshold: 12,
  });
});

test("getInventoryCategoryBreakdownMetrics folds remainder into Other", async () => {
  const result = await getInventoryCategoryBreakdownMetrics(
    ownerId,
    2,
    {},
    createDeps(),
  );

  assert.equal(result.categories.length, 3);
  assert.equal(result.categories[0]?.categoryName, "Technology");
  assert.equal(result.categories[1]?.categoryName, "Art Supplies");
  assert.equal(result.categories[2]?.categoryName, "Other");
  assert.equal(result.categories[2]?.skuCount, 1);
  assert.equal(result.categories[2]?.totalQuantity, 3);
  assert.equal(result.categories[2]?.totalValue, 24);
});

test("getInventoryCategoryBreakdownMetrics returns all categories when already within top limit", async () => {
  const result = await getInventoryCategoryBreakdownMetrics(
    ownerId,
    5,
    {},
    createDeps(),
  );

  assert.equal(result.categories.length, 3);
  assert.equal(result.categories[2]?.categoryName, "Uncategorized");
});

test("getInventoryMovementSummaryMetrics returns org-wide movement totals", async () => {
  const result = await getInventoryMovementSummaryMetrics(ownerId, {}, createDeps());

  assert.deepEqual(result, {
    scope: {
      productId: null,
      days: null,
    },
    summary: {
      movementCount: 9,
      stockInQuantity: 100,
      stockOutQuantity: 50,
      transferInQuantity: 12,
      transferOutQuantity: 6,
      adjustmentIncreaseQuantity: 4,
      adjustmentDecreaseQuantity: 2,
      inboundQuantity: 116,
      outboundQuantity: 58,
      netQuantity: 58,
    },
  });
});

test("getInventoryMovementSummaryMetrics preserves scoped product and day filters", async () => {
  let capturedOptions: { productId?: string; days?: number } | null = null;

  const result = await getInventoryMovementSummaryMetrics(
    ownerId,
    {
      productId: "22222222-2222-2222-2222-222222222222",
      days: 30,
    },
    createDeps({
      selectInventoryMovementSummaryByOwnerId: async (
        _ownerId: string,
        options?: { productId?: string; days?: number },
      ) => {
        capturedOptions = options ?? null;
        return {
          movement_count: "1",
          stock_in_quantity: "0",
          stock_out_quantity: "0",
          transfer_in_quantity: "3",
          transfer_out_quantity: "1",
          adjustment_increase_quantity: "0",
          adjustment_decrease_quantity: "0",
        };
      },
    }),
  );

  assert.deepEqual(capturedOptions, {
    productId: "22222222-2222-2222-2222-222222222222",
    days: 30,
    criticalThreshold: 10,
    lowThreshold: 25,
  });
  assert.equal(result.scope.productId, "22222222-2222-2222-2222-222222222222");
  assert.equal(result.scope.days, 30);
  assert.equal(result.summary.transferInQuantity, 3);
  assert.equal(result.summary.transferOutQuantity, 1);
});
