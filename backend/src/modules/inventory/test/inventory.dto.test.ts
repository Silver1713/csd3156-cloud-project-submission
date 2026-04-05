import assert from "node:assert/strict";
import test from "node:test";

import { createInventoryAdjustmentSchema } from "../dto/create-adjustment.dto.js";
import { createInventorySchema } from "../dto/create-inventory.dto.js";
import { createStockMovementSchema } from "../dto/create-movement.dto.js";
import { updateInventorySchema } from "../dto/update-inventory.dto.js";

const productId = "11111111-1111-4111-8111-111111111111";

test("createInventorySchema accepts valid product inventory payload", () => {
  const result = createInventorySchema.safeParse({
    productId,
    quantity: 8,
  });

  assert.equal(result.success, true);
});

test("createInventorySchema rejects negative quantity", () => {
  const result = createInventorySchema.safeParse({
    productId,
    quantity: -1,
  });

  assert.equal(result.success, false);
});

test("updateInventorySchema accepts zero quantity", () => {
  const result = updateInventorySchema.safeParse({
    quantity: 0,
  });

  assert.equal(result.success, true);
});

test("createStockMovementSchema rejects unsupported movement type", () => {
  const result = createStockMovementSchema.safeParse({
    productId,
    type: "INVALID",
    quantity: 5,
  });

  assert.equal(result.success, false);
});

test("createStockMovementSchema rejects non-positive quantity", () => {
  const result = createStockMovementSchema.safeParse({
    productId,
    type: "STOCK_IN",
    quantity: 0,
  });

  assert.equal(result.success, false);
});

test("createStockMovementSchema accepts an optional movement reason", () => {
  const result = createStockMovementSchema.safeParse({
    productId,
    type: "TRANSFER_OUT",
    quantity: 2,
    reason: "Relocating stock to overflow storage",
  });

  assert.equal(result.success, true);
});

test("createInventoryAdjustmentSchema requires a non-empty reason", () => {
  const result = createInventoryAdjustmentSchema.safeParse({
    productId,
    direction: "increase",
    quantity: 2,
    reason: "   ",
  });

  assert.equal(result.success, false);
});
