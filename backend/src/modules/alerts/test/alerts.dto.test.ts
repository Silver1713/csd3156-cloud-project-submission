import test from "node:test";
import assert from "node:assert/strict";

import {
  createAlertSchema,
  listAlertsQuerySchema,
  updateAlertSchema,
} from "../dto/alerts.dto.js";

test("createAlertSchema accepts a valid alert payload", () => {
  const result = createAlertSchema.safeParse({
    productId: "4cf7f6ef-1111-4222-8333-444444444444",
    type: "low_stock",
    status: "active",
    thresholdQuantity: 10,
    currentQuantity: 4,
    message: "Low stock threshold reached",
  });

  assert.equal(result.success, true);
});

test("createAlertSchema accepts a custom definition-linked alert without productId", () => {
  const result = createAlertSchema.safeParse({
    alertDefinitionId: "5cf7f6ef-1111-4222-8333-444444444444",
    type: "custom",
    status: "active",
  });

  assert.equal(result.success, true);
});

test("createAlertSchema rejects productless alerts without a linked definition", () => {
  const result = createAlertSchema.safeParse({
    type: "custom",
    status: "active",
  });

  assert.equal(result.success, false);
});

test("createAlertSchema rejects alertDefinitionId on non-custom alerts", () => {
  const result = createAlertSchema.safeParse({
    productId: "4cf7f6ef-1111-4222-8333-444444444444",
    alertDefinitionId: "5cf7f6ef-1111-4222-8333-444444444444",
    type: "low_stock",
    status: "active",
  });

  assert.equal(result.success, false);
});

test("listAlertsQuerySchema applies defaults and accepts filters", () => {
  const result = listAlertsQuerySchema.safeParse({
    status: "active",
    type: "critical_stock",
    productId: "4cf7f6ef-1111-4222-8333-444444444444",
  });

  assert.equal(result.success, true);
  if (!result.success) return;

  assert.equal(result.data.limit, 50);
  assert.equal(result.data.offset, 0);
  assert.equal(result.data.status, "active");
  assert.equal(result.data.type, "critical_stock");
});

test("updateAlertSchema rejects empty payloads", () => {
  const result = updateAlertSchema.safeParse({});
  assert.equal(result.success, false);
});

test("updateAlertSchema accepts nullable message and threshold fields", () => {
  const result = updateAlertSchema.safeParse({
    status: "resolved",
    thresholdQuantity: null,
    currentQuantity: null,
    message: null,
  });

  assert.equal(result.success, true);
});
