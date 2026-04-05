import test from "node:test";
import assert from "node:assert/strict";

import {
  createAlertDefinitionForOrganization,
  deleteAlertDefinitionById,
  getAlertDefinitionById,
  listAlertDefinitionsForOrganization,
  updateAlertDefinitionById,
} from "../services/alert-definitions.service.js";
import type { AlertConditionNode } from "../dto/alert-definitions.dto.js";
import { BadRequestError } from "../../../types/http-error.types.js";

const ownerId = "11111111-1111-1111-1111-111111111111";
const actorId = "22222222-2222-2222-2222-222222222222";
const alertDefinitionId = "33333333-3333-3333-3333-333333333333";
const sampleCondition: AlertConditionNode = {
  kind: "comparison",
  operator: "lt",
  left: { kind: "metric", source: "base", key: "totalQuantity" },
  right: { kind: "number", value: 50 },
};

const sampleAlertDefinitionRow = {
  id: alertDefinitionId,
  org_id: ownerId,
  key: "low_stock_alert",
  name: "Low Stock Alert",
  description: "Warn when quantity gets too low",
  severity: "high" as const,
  scope: "organization" as const,
  condition_json: sampleCondition,
  is_active: true,
  created_by: actorId,
  created_at: new Date("2026-04-03T00:00:00.000Z"),
  updated_at: new Date("2026-04-03T00:00:00.000Z"),
};

function createDeps(overrides: Record<string, unknown> = {}) {
  return {
    listAlertDefinitionsByOrgId: async () => [sampleAlertDefinitionRow],
    selectAlertDefinitionById: async () => sampleAlertDefinitionRow,
    createAlertDefinition: async () => sampleAlertDefinitionRow,
    updateAlertDefinition: async () => sampleAlertDefinitionRow,
    deleteAlertDefinition: async () => sampleAlertDefinitionRow,
    listMetricDefinitionsByOrgId: async () => [],
    ...overrides,
  };
}

test("listAlertDefinitionsForOrganization maps alert definition rows", async () => {
  const result = await listAlertDefinitionsForOrganization(ownerId, createDeps());

  assert.equal(result.alertDefinitions.length, 1);
  assert.equal(result.alertDefinitions[0]?.key, "low_stock_alert");
  assert.equal(result.alertDefinitions[0]?.condition, sampleAlertDefinitionRow.condition_json);
});

test("getAlertDefinitionById returns null when repository misses", async () => {
  const result = await getAlertDefinitionById(
    alertDefinitionId,
    ownerId,
    createDeps({
      selectAlertDefinitionById: async () => null,
    }),
  );

  assert.equal(result, null);
});

test("createAlertDefinitionForOrganization passes org and actor context to repository", async () => {
  let capturedOrgId: string | null = null;
  let capturedCreatedBy: string | null = null;

  const result = await createAlertDefinitionForOrganization(
    ownerId,
    actorId,
    {
      key: "low_stock_alert",
      name: "Low Stock Alert",
      severity: "high",
      scope: "organization",
      condition: sampleCondition,
    },
    createDeps({
      createAlertDefinition: async (input: {
        orgId: string;
        createdBy: string;
      }) => {
        capturedOrgId = input.orgId;
        capturedCreatedBy = input.createdBy;
        return sampleAlertDefinitionRow;
      },
    }),
  );

  assert.equal(capturedOrgId, ownerId);
  assert.equal(capturedCreatedBy, actorId);
  assert.equal(result.engineStatus, "stub");
});

test("updateAlertDefinitionById returns stub engine status", async () => {
  const result = await updateAlertDefinitionById(
    alertDefinitionId,
    ownerId,
    {
      isActive: false,
    },
    createDeps({
      updateAlertDefinition: async () => ({
        ...sampleAlertDefinitionRow,
        is_active: false,
      }),
    }),
  );

  assert.equal(result?.alertDefinition.isActive, false);
  assert.equal(result?.engineStatus, "stub");
});

test("deleteAlertDefinitionById maps repository rows", async () => {
  const result = await deleteAlertDefinitionById(
    alertDefinitionId,
    ownerId,
    createDeps(),
  );

  assert.equal(result?.alertDefinition.id, alertDefinitionId);
});

test("createAlertDefinitionForOrganization rejects missing custom metric references", async () => {
  await assert.rejects(
    () =>
      createAlertDefinitionForOrganization(
        ownerId,
        actorId,
        {
          key: "broken_alert",
          name: "Broken Alert",
          severity: "high",
          scope: "organization",
          condition: {
            kind: "comparison",
            operator: "gt",
            left: { kind: "metric", source: "definition", key: "missing_metric" },
            right: { kind: "number", value: 10 },
          },
        },
        createDeps(),
      ),
    (error: unknown) =>
      error instanceof BadRequestError &&
      error.message.includes('Referenced custom metric "missing_metric" does not exist'),
  );
});

test("updateAlertDefinitionById rejects custom metric scope mismatches", async () => {
  await assert.rejects(
    () =>
      updateAlertDefinitionById(
        alertDefinitionId,
        ownerId,
        {
          condition: {
            kind: "comparison",
            operator: "gt",
            left: { kind: "metric", source: "definition", key: "product_metric" },
            right: { kind: "number", value: 5 },
          },
        },
        createDeps({
          listMetricDefinitionsByOrgId: async () => [
            {
              id: "metric-1",
              org_id: ownerId,
              key: "product_metric",
              name: "Product Metric",
              description: null,
              scope: "product",
              format: "number",
              definition_json: { kind: "metric", key: "totalQuantity" },
              is_active: true,
              created_by: actorId,
              created_at: new Date("2026-04-03T00:00:00.000Z"),
              updated_at: new Date("2026-04-03T00:00:00.000Z"),
            },
          ],
        }),
      ),
    (error: unknown) =>
      error instanceof BadRequestError &&
      error.message.includes('has scope "product" and cannot be used in a "organization" alert'),
  );
});
