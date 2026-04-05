import assert from "node:assert/strict";
import test from "node:test";

import { evaluateMetricDefinition } from "./metric-definition-engine.js";

test("evaluateMetricDefinition computes arithmetic metric formulas", () => {
  const result = evaluateMetricDefinition({
    definition: {
      kind: "mul",
      left: {
        kind: "div",
        left: { kind: "metric", key: "stockOutQuantity" },
        right: { kind: "metric", key: "stockInQuantity" },
      },
      right: { kind: "number", value: 100 },
    },
    scope: { orgId: "org-1" },
    baseMetrics: {
      stockInQuantity: 25,
      stockOutQuantity: 10,
    },
  });

  assert.equal(result.status, "ready");
  assert.equal(result.value, 40);
});

test("evaluateMetricDefinition returns a reason when runtime division reaches zero", () => {
  const result = evaluateMetricDefinition({
    definition: {
      kind: "div",
      left: { kind: "metric", key: "stockOutQuantity" },
      right: { kind: "metric", key: "stockInQuantity" },
    },
    scope: { orgId: "org-1" },
    baseMetrics: {
      stockInQuantity: 0,
      stockOutQuantity: 10,
    },
  });

  assert.equal(result.status, "ready");
  assert.equal(result.value, null);
  assert.match(result.reason ?? "", /division by zero/i);
});
