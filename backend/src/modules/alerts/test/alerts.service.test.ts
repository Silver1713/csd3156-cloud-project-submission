import test from "node:test";
import assert from "node:assert/strict";

import {
  createAlert,
  deleteAlertById,
  getAlertById,
  listAlerts,
  updateAlertById,
} from "../services/alerts.service.js";
import { BadRequestError } from "../../../types/http-error.types.js";

const ownerId = "11111111-1111-1111-1111-111111111111";
const alertId = "22222222-2222-2222-2222-222222222222";
const actorId = "33333333-3333-3333-3333-333333333333";
const productId = "44444444-4444-4444-4444-444444444444";

const sampleAlertRow = {
  id: alertId,
  owner_id: ownerId,
  product_id: productId,
  triggered_by_movement_id: null,
  alert_definition_id: null,
  type: "low_stock" as const,
  status: "active" as const,
  threshold_quantity: 10,
  current_quantity: 4,
  message: "Low stock threshold reached",
  acknowledged_by: null,
  acknowledged_at: null,
  created_at: new Date("2026-04-03T00:00:00.000Z"),
  product_name: "Widget",
  product_sku: "WGT-001",
  acknowledged_by_name: null,
  acknowledged_by_username: null,
};

function createDeps(overrides: Record<string, unknown> = {}) {
  return {
    listActiveAlertDefinitionsByOrgId: async () => [],
    selectAlertsByOwnerId: async () => [sampleAlertRow],
    countAlertsByOwnerId: async () => 1,
    selectAlertById: async () => sampleAlertRow,
    selectOpenAlertByDefinitionId: async () => null,
    insertAlert: async (input: {
      ownerId: string;
      productId?: string | null;
      triggeredByMovementId?: string | null;
      alertDefinitionId?: string | null;
      type: string;
      status: string;
      thresholdQuantity?: number | null;
      currentQuantity?: number | null;
      message?: string | null;
    }) => ({
      ...sampleAlertRow,
      owner_id: input.ownerId,
      product_id: input.productId ?? null,
      triggered_by_movement_id: input.triggeredByMovementId ?? null,
      alert_definition_id: input.alertDefinitionId ?? null,
      type: input.type as typeof sampleAlertRow.type,
      status: input.status as typeof sampleAlertRow.status,
      threshold_quantity: input.thresholdQuantity ?? null,
      current_quantity: input.currentQuantity ?? null,
      message: input.message ?? null,
    }),
    updateAlert: async (input: {
      alertId: string;
      ownerId: string;
      status?: string | undefined;
      thresholdQuantity?: number | null | undefined;
      currentQuantity?: number | null | undefined;
      message?: string | null | undefined;
      acknowledgedBy?: string | null;
    }) => ({
      ...sampleAlertRow,
      id: input.alertId,
      owner_id: input.ownerId,
      status: (input.status ?? sampleAlertRow.status) as typeof sampleAlertRow.status,
      threshold_quantity:
        input.thresholdQuantity === undefined
          ? sampleAlertRow.threshold_quantity
          : input.thresholdQuantity,
      current_quantity:
        input.currentQuantity === undefined
          ? sampleAlertRow.current_quantity
          : input.currentQuantity,
      message:
        input.message === undefined ? sampleAlertRow.message : input.message,
      acknowledged_by:
        input.status === "acknowledged" ? (input.acknowledgedBy ?? null) : null,
      acknowledged_at:
        input.status === "acknowledged"
          ? new Date("2026-04-03T01:00:00.000Z")
          : null,
      acknowledged_by_name:
        input.status === "acknowledged" ? "Alert Manager" : null,
      acknowledged_by_username:
        input.status === "acknowledged" ? "alert_manager" : null,
    }),
    deleteAlert: async () => sampleAlertRow,
    ...overrides,
  };
}

test("listAlerts scopes repository access by organization owner id", async () => {
  let capturedQuery:
    | {
        ownerId: string;
        status?: string;
        type?: string;
        productId?: string;
        limit: number;
        offset: number;
      }
    | null = null;

  const result = await listAlerts(
    ownerId,
    {
      status: "active",
      type: "low_stock",
      productId,
      limit: 25,
      offset: 10,
    },
    createDeps({
      selectAlertsByOwnerId: async (queryInput: typeof capturedQuery) => {
        capturedQuery = queryInput;
        return [sampleAlertRow];
      },
    }),
  );

  assert.deepEqual(capturedQuery, {
    ownerId,
    status: "active",
    type: "low_stock",
    productId,
    limit: 25,
    offset: 10,
  });
  assert.equal(result.alerts[0]?.productName, "Widget");
  assert.equal(result.pagination.total, 1);
});

test("getAlertById maps a stored alert row", async () => {
  const result = await getAlertById(alertId, ownerId, createDeps());

  assert.equal(result?.id, alertId);
  assert.equal(result?.status, "active");
  assert.equal(result?.message, "Low stock threshold reached");
});

test("createAlert forwards owner scope and payload to the repository", async () => {
  let capturedOwnerId: string | null = null;
  let capturedAlertDefinitionId: string | null | undefined;
  const alertDefinitionId = "55555555-5555-5555-5555-555555555555";

  const result = await createAlert(
    ownerId,
    {
      productId,
      alertDefinitionId,
      type: "custom",
      status: "active",
      thresholdQuantity: 5,
      currentQuantity: 2,
      message: "Critical stock threshold reached",
    },
    createDeps({
      insertAlert: async (input: {
        ownerId: string;
        alertDefinitionId?: string | null;
      }) => {
        capturedOwnerId = input.ownerId;
        capturedAlertDefinitionId = input.alertDefinitionId;
        return {
          ...sampleAlertRow,
          owner_id: input.ownerId,
          alert_definition_id: input.alertDefinitionId ?? null,
          type: "custom" as const,
          threshold_quantity: 5,
          current_quantity: 2,
          message: "Critical stock threshold reached",
        };
      },
    }),
  );

  assert.equal(capturedOwnerId, ownerId);
  assert.equal(capturedAlertDefinitionId, alertDefinitionId);
  assert.equal(result.alertDefinitionId, alertDefinitionId);
  assert.equal(result.type, "custom");
});

test("createAlert rejects productless alerts without a linked definition", async () => {
  await assert.rejects(
    () =>
      createAlert(
        ownerId,
        {
          type: "custom",
          status: "active",
        },
        createDeps(),
      ),
    (error: unknown) =>
      error instanceof BadRequestError &&
      error.message.includes(
        "productId is required unless this is a custom alert linked to an alert definition",
      ),
  );
});

test("createAlert rejects alertDefinitionId on non-custom alerts", async () => {
  await assert.rejects(
    () =>
      createAlert(
        ownerId,
        {
          productId,
          alertDefinitionId: "55555555-5555-5555-5555-555555555555",
          type: "low_stock",
          status: "active",
        },
        createDeps(),
      ),
    (error: unknown) =>
      error instanceof BadRequestError &&
      error.message.includes("alertDefinitionId can only be used with custom alerts"),
  );
});

test("updateAlertById uses the current actor when acknowledging an alert", async () => {
  let capturedAcknowledgedBy: string | null | undefined;

  const result = await updateAlertById(
    alertId,
    ownerId,
    actorId,
    {
      status: "acknowledged",
    },
    createDeps({
      updateAlert: async (input: { acknowledgedBy?: string | null }) => {
        capturedAcknowledgedBy = input.acknowledgedBy;
        return {
          ...sampleAlertRow,
          status: "acknowledged" as const,
          acknowledged_by: actorId,
          acknowledged_at: new Date("2026-04-03T01:00:00.000Z"),
          acknowledged_by_name: "Alert Manager",
          acknowledged_by_username: "alert_manager",
        };
      },
    }),
  );

  assert.equal(capturedAcknowledgedBy, actorId);
  assert.equal(result?.status, "acknowledged");
  assert.equal(result?.acknowledgedBy?.id, actorId);
});

test("deleteAlertById returns the deleted alert when found", async () => {
  const result = await deleteAlertById(alertId, ownerId, createDeps());

  assert.equal(result?.id, alertId);
  assert.equal(result?.productSku, "WGT-001");
});
