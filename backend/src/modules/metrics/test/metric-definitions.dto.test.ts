import assert from "node:assert/strict";
import test from "node:test";

import {
  createMetricDefinitionSchema,
  updateMetricDefinitionSchema,
} from "../dto/metrics.dto.js";

test("createMetricDefinitionSchema accepts a valid metric formula payload", () => {
  const parsed = createMetricDefinitionSchema.safeParse({
    key: "outflow_ratio",
    name: "Outflow Ratio",
    format: "percent",
    definition: {
      kind: "mul",
      left: {
        kind: "div",
        left: { kind: "metric", key: "stockOutQuantity" },
        right: {
          kind: "add",
          left: { kind: "metric", key: "stockInQuantity" },
          right: { kind: "metric", key: "stockOutQuantity" },
        },
      },
      right: { kind: "number", value: 100 },
    },
  });

  assert.equal(parsed.success, true);
});

test("createMetricDefinitionSchema rejects invalid metric keys", () => {
  const parsed = createMetricDefinitionSchema.safeParse({
    key: "BadKey",
    name: "Bad Metric",
    definition: {
      kind: "metric",
      key: "notRealMetric",
    },
  });

  assert.equal(parsed.success, false);
});

test("updateMetricDefinitionSchema accepts partial metric updates", () => {
  const parsed = updateMetricDefinitionSchema.safeParse({
    name: "Updated Outflow Ratio",
    isActive: false,
  });

  assert.equal(parsed.success, true);
});

test("updateMetricDefinitionSchema rejects empty payloads", () => {
  const parsed = updateMetricDefinitionSchema.safeParse({});
  assert.equal(parsed.success, false);
});

