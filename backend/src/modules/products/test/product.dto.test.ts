import test from "node:test";
import assert from "node:assert/strict";

import {
  createProductSchema,
  listProductsQuerySchema,
  updateProductSchema,
} from "../dto/product.dto.js";

test("createProductSchema accepts valid product payloads without ownerId", () => {
  const result = createProductSchema.safeParse({
    name: "Widget",
    description: "Useful widget",
    sku: "WGT-001",
    imageObjectKey: "products/11111111-1111-1111-1111-111111111111/widget.jpg",
    productCategoryId: "4cf7f6ef-1111-4222-8333-444444444444",
    unitCost: 19.99,
  });

  assert.equal(result.success, true);
});

test("createProductSchema rejects payloads without a name", () => {
  const result = createProductSchema.safeParse({
    sku: "WGT-001",
  });

  assert.equal(result.success, false);
});

test("updateProductSchema accepts valid update payloads", () => {
  const result = updateProductSchema.safeParse({
    name: "Updated Widget",
    description: null,
    sku: "WGT-002",
    imageObjectKey: "products/11111111-1111-1111-1111-111111111111/widget-2.jpg",
    productCategoryId: null,
    unitCost: 29.5,
  });

  assert.equal(result.success, true);
});

test("listProductsQuerySchema applies defaults and accepts filters", () => {
  const result = listProductsQuerySchema.safeParse({
    q: "widget",
    sku: "WGT-001",
    productCategoryId: "4cf7f6ef-1111-4222-8333-444444444444",
    hasInventory: "true",
    minQuantity: "5",
    maxQuantity: "25",
    minUnitCost: "10.5",
    maxUnitCost: "50",
    sortBy: "unitCost",
    sortOrder: "asc",
  });

  assert.equal(result.success, true);
  if (!result.success) {
    return;
  }

  assert.equal(result.data.limit, 50);
  assert.equal(result.data.offset, 0);
  assert.equal(result.data.q, "widget");
  assert.equal(result.data.sku, "WGT-001");
  assert.equal(
    result.data.productCategoryId,
    "4cf7f6ef-1111-4222-8333-444444444444",
  );
  assert.equal(result.data.hasInventory, true);
  assert.equal(result.data.minQuantity, 5);
  assert.equal(result.data.maxQuantity, 25);
  assert.equal(result.data.minUnitCost, 10.5);
  assert.equal(result.data.maxUnitCost, 50);
  assert.equal(result.data.sortBy, "unitCost");
  assert.equal(result.data.sortOrder, "asc");
});

test("listProductsQuerySchema rejects invalid quantity ranges", () => {
  const result = listProductsQuerySchema.safeParse({
    minQuantity: 10,
    maxQuantity: 5,
  });

  assert.equal(result.success, false);
});

test("listProductsQuerySchema rejects invalid unit-cost ranges", () => {
  const result = listProductsQuerySchema.safeParse({
    minUnitCost: 20,
    maxUnitCost: 10,
  });

  assert.equal(result.success, false);
});
