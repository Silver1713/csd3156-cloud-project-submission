import assert from "node:assert/strict";
import test from "node:test";

import { evaluateAlertDefinition } from "./alert-definition-engine.js";

test("evaluateAlertDefinition computes comparison and logical conditions", () => {
  const result = evaluateAlertDefinition({
    condition: {
      kind: "logical",
      operator: "and",
      conditions: [
        {
          kind: "comparison",
          operator: "lt",
          left: { kind: "metric", source: "base", key: "totalQuantity" },
          right: { kind: "number", value: 50 },
        },
        {
          kind: "comparison",
          operator: "gt",
          left: { kind: "metric", source: "definition", key: "outflow_ratio" },
          right: { kind: "number", value: 70 },
        },
      ],
    },
    scope: { orgId: "org-1" },
    baseMetrics: {
      totalQuantity: 40,
    },
    customMetrics: {
      outflow_ratio: 80,
    },
  });

  assert.equal(result.status, "ready");
  assert.equal(result.triggered, true);
});

test("evaluateAlertDefinition returns a reason when a metric is missing", () => {
  const result = evaluateAlertDefinition({
    condition: {
      kind: "comparison",
      operator: "gt",
      left: { kind: "metric", source: "definition", key: "outflow_ratio" },
      right: { kind: "number", value: 70 },
    },
    scope: { orgId: "org-1" },
    baseMetrics: {},
  });

  assert.equal(result.status, "ready");
  assert.equal(result.triggered, null);
  assert.match(result.reason ?? "", /not available/i);
});
