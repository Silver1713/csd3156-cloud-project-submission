import test from "node:test";
import assert from "node:assert/strict";

import {
  createAlertDefinitionSchema,
  updateAlertDefinitionSchema,
} from "../dto/alert-definitions.dto.js";

test("createAlertDefinitionSchema accepts a valid comparison condition", () => {
  const result = createAlertDefinitionSchema.safeParse({
    key: "low_stock_alert",
    name: "Low Stock Alert",
    severity: "high",
    scope: "organization",
    condition: {
      kind: "comparison",
      operator: "lt",
      left: {
        kind: "metric",
        source: "base",
        key: "totalQuantity",
      },
      right: {
        kind: "number",
        value: 50,
      },
    },
  });

  assert.equal(result.success, true);
});

test("createAlertDefinitionSchema accepts a logical condition with custom metric references", () => {
  const result = createAlertDefinitionSchema.safeParse({
    key: "outflow_risk",
    name: "Outflow Risk",
    condition: {
      kind: "logical",
      operator: "and",
      conditions: [
        {
          kind: "comparison",
          operator: "gt",
          left: {
            kind: "metric",
            source: "definition",
            key: "outflow_ratio",
          },
          right: {
            kind: "number",
            value: 70,
          },
        },
        {
          kind: "comparison",
          operator: "gt",
          left: {
            kind: "metric",
            source: "base",
            key: "criticalCount",
          },
          right: {
            kind: "number",
            value: 0,
          },
        },
      ],
    },
  });

  assert.equal(result.success, true);
});

test("createAlertDefinitionSchema rejects invalid custom metric keys", () => {
  const result = createAlertDefinitionSchema.safeParse({
    key: "bad_key",
    name: "Bad Alert",
    condition: {
      kind: "comparison",
      operator: "gt",
      left: {
        kind: "metric",
        source: "definition",
        key: "Bad Key",
      },
      right: {
        kind: "number",
        value: 10,
      },
    },
  });

  assert.equal(result.success, false);
});

test("updateAlertDefinitionSchema rejects empty payloads", () => {
  const result = updateAlertDefinitionSchema.safeParse({});
  assert.equal(result.success, false);
});
