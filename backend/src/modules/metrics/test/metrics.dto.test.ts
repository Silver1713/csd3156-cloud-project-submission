import assert from "node:assert/strict";
import test from "node:test";

import {
  inventoryCategoryBreakdownQuerySchema,
  inventoryMovementSummaryQuerySchema,
  inventoryMovementTrendQuerySchema,
  inventoryOverviewQuerySchema,
} from "../dto/metrics.dto.js";

const productId = "11111111-1111-4111-8111-111111111111";
const categoryIdA = "22222222-2222-4222-8222-222222222222";
const categoryIdB = "33333333-3333-4333-8333-333333333333";

test("inventoryOverviewQuerySchema accepts metrics filters and threshold overrides", () => {
  const result = inventoryOverviewQuerySchema.safeParse({
    q: "venz",
    productId,
    categoryIds: `${categoryIdA},${categoryIdB}`,
    stockState: "critical",
    criticalThreshold: 5,
    lowThreshold: 15,
  });

  assert.equal(result.success, true);
  assert.deepEqual(result.data, {
    q: "venz",
    productId,
    categoryIds: [categoryIdA, categoryIdB],
    stockState: "critical",
    criticalThreshold: 5,
    lowThreshold: 15,
  });
});

test("inventoryMovementTrendQuerySchema applies the default days value", () => {
  const result = inventoryMovementTrendQuerySchema.safeParse({});

  assert.equal(result.success, true);
  assert.equal(result.data.days, 7);
});

test("inventoryCategoryBreakdownQuerySchema applies the default top value", () => {
  const result = inventoryCategoryBreakdownQuerySchema.safeParse({});

  assert.equal(result.success, true);
  assert.equal(result.data.top, 5);
});

test("inventoryMovementSummaryQuerySchema accepts optional days and stockState", () => {
  const result = inventoryMovementSummaryQuerySchema.safeParse({
    days: 30,
    stockState: "healthy",
  });

  assert.equal(result.success, true);
  assert.equal(result.data.days, 30);
  assert.equal(result.data.stockState, "healthy");
});

test("metrics query schemas reject lowThreshold below criticalThreshold", () => {
  const result = inventoryOverviewQuerySchema.safeParse({
    criticalThreshold: 20,
    lowThreshold: 10,
  });

  assert.equal(result.success, false);
});

test("metrics query schemas reject invalid categoryIds csv values", () => {
  const result = inventoryCategoryBreakdownQuerySchema.safeParse({
    categoryIds: "not-a-uuid,still-not-a-uuid",
  });

  assert.equal(result.success, false);
});
