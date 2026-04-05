import assert from "node:assert/strict";
import test from "node:test";

import {
  createMetricDefinitionForOrganization,
  getBaseMetricCatalog,
  getMetricDefinitionById,
  listMetricDefinitionsForOrganization,
  previewMetricDefinitionForOrganization,
  updateMetricDefinitionById,
  deleteMetricDefinitionById,
} from "../services/metrics.service.js";
import { BadRequestError } from "../../../types/http-error.types.js";

const ownerId = "11111111-1111-1111-1111-111111111111";
const actorId = "22222222-2222-2222-2222-222222222222";

test("getBaseMetricCatalog returns the system base metrics", () => {
  const result = getBaseMetricCatalog();

  assert.ok(result.metrics.length > 5);
  assert.equal(result.metrics[0]?.key, "totalSku");
});

test("listMetricDefinitionsForOrganization maps metric definition rows", async () => {
  const result = await listMetricDefinitionsForOrganization(ownerId, {
    selectInventoryOverviewByOwnerId: async () => {
      throw new Error("not used");
    },
    selectInventoryMovementTrendByOwnerId: async () => {
      throw new Error("not used");
    },
    selectInventoryMovementSummaryByOwnerId: async () => {
      throw new Error("not used");
    },
    selectInventoryCategoryBreakdownByOwnerId: async () => {
      throw new Error("not used");
    },
    findOrganizationById: async () => null,
    createMetricDefinition: async () => {
      throw new Error("not used");
    },
    selectMetricDefinitionById: async () => {
      throw new Error("not used");
    },
    updateMetricDefinition: async () => {
      throw new Error("not used");
    },
    deleteMetricDefinition: async () => {
      throw new Error("not used");
    },
    listMetricDefinitionsByOrgId: async () => [
      {
        id: "metric-1",
        org_id: ownerId,
        key: "outflow_ratio",
        name: "Outflow Ratio",
        description: null,
        scope: "organization",
        format: "percent",
        definition_json: { kind: "metric", key: "outboundQuantity" },
        is_active: true,
        created_by: actorId,
        created_at: new Date("2026-04-02T00:00:00.000Z"),
        updated_at: new Date("2026-04-02T00:00:00.000Z"),
      },
    ],
  });

  assert.equal(result.metrics.length, 1);
  assert.equal(result.metrics[0]?.key, "outflow_ratio");
});

test("createMetricDefinitionForOrganization passes org and actor context to repository", async () => {
  let capturedInput: Record<string, unknown> | null = null;

  const result = await createMetricDefinitionForOrganization(
    ownerId,
    actorId,
    {
      key: "outflow_ratio",
      name: "Outflow Ratio",
      scope: "organization",
      format: "percent",
      definition: { kind: "metric", key: "outboundQuantity" },
    },
    {
      selectInventoryOverviewByOwnerId: async () => {
        throw new Error("not used");
      },
      selectInventoryMovementTrendByOwnerId: async () => {
        throw new Error("not used");
      },
      selectInventoryMovementSummaryByOwnerId: async () => {
        throw new Error("not used");
      },
      selectInventoryCategoryBreakdownByOwnerId: async () => {
        throw new Error("not used");
      },
      findOrganizationById: async () => null,
      listMetricDefinitionsByOrgId: async () => [],
      selectMetricDefinitionById: async () => {
        throw new Error("not used");
      },
      createMetricDefinition: async (input) => {
        capturedInput = input;
        return {
          id: "metric-1",
          org_id: input.orgId,
          key: input.key,
          name: input.name,
          description: input.description ?? null,
          scope: input.scope,
          format: input.format,
          definition_json: input.definition,
          is_active: true,
          created_by: input.createdBy,
          created_at: new Date("2026-04-02T00:00:00.000Z"),
          updated_at: new Date("2026-04-02T00:00:00.000Z"),
        };
      },
      updateMetricDefinition: async () => {
        throw new Error("not used");
      },
      deleteMetricDefinition: async () => {
        throw new Error("not used");
      },
    },
  );

  assert.deepEqual(capturedInput, {
    orgId: ownerId,
    key: "outflow_ratio",
    name: "Outflow Ratio",
    scope: "organization",
    format: "percent",
    definition: { kind: "metric", key: "outboundQuantity" },
    createdBy: actorId,
  });
  assert.equal(result.metric.orgId, ownerId);
});

test("createMetricDefinitionForOrganization rejects semantic division by zero", async () => {
  await assert.rejects(
    () =>
      createMetricDefinitionForOrganization(
        ownerId,
        actorId,
        {
          key: "broken_ratio",
          name: "Broken Ratio",
          scope: "organization",
          format: "number",
          definition: {
            kind: "div",
            left: { kind: "metric", key: "outboundQuantity" },
            right: { kind: "number", value: 0 },
          },
        },
        {
          selectInventoryOverviewByOwnerId: async () => {
            throw new Error("not used");
          },
          selectInventoryMovementTrendByOwnerId: async () => {
            throw new Error("not used");
          },
          selectInventoryMovementSummaryByOwnerId: async () => {
            throw new Error("not used");
          },
          selectInventoryCategoryBreakdownByOwnerId: async () => {
            throw new Error("not used");
          },
          findOrganizationById: async () => null,
          listMetricDefinitionsByOrgId: async () => [],
          selectMetricDefinitionById: async () => {
            throw new Error("not used");
          },
          createMetricDefinition: async () => {
            throw new Error("should not create metric definition");
          },
          updateMetricDefinition: async () => {
            throw new Error("not used");
          },
          deleteMetricDefinition: async () => {
            throw new Error("not used");
          },
        },
      ),
    (error: unknown) =>
      error instanceof BadRequestError &&
      error.message.includes("Division by a literal zero is not allowed"),
  );
});

test("previewMetricDefinitionForOrganization evaluates a metric definition from resolved base metrics", async () => {
  const result = await previewMetricDefinitionForOrganization(
    ownerId,
    {
      definition: {
        kind: "mul",
        left: {
          kind: "div",
          left: { kind: "metric", key: "stockOutQuantity" },
          right: { kind: "metric", key: "stockInQuantity" },
        },
        right: { kind: "number", value: 100 },
      },
      filters: {
        days: 30,
      },
    },
    {
      selectInventoryOverviewByOwnerId: async () => ({
        total_sku: "3",
        total_quantity: "120",
        total_value: "540",
        critical_count: "1",
        low_count: "1",
      }),
      selectInventoryMovementTrendByOwnerId: async () => {
        throw new Error("not used");
      },
      selectInventoryMovementSummaryByOwnerId: async () => ({
        movement_count: "8",
        stock_in_quantity: "25",
        stock_out_quantity: "10",
        transfer_in_quantity: "5",
        transfer_out_quantity: "2",
        adjustment_increase_quantity: "1",
        adjustment_decrease_quantity: "0",
      }),
      selectInventoryCategoryBreakdownByOwnerId: async () => {
        throw new Error("not used");
      },
      findOrganizationById: async () => null,
      listMetricDefinitionsByOrgId: async () => [],
      selectMetricDefinitionById: async () => {
        throw new Error("not used");
      },
      createMetricDefinition: async () => {
        throw new Error("not used");
      },
      updateMetricDefinition: async () => {
        throw new Error("not used");
      },
      deleteMetricDefinition: async () => {
        throw new Error("not used");
      },
    },
  );

  assert.equal(result.preview.status, "ready");
  assert.equal(result.preview.value, 40);
  assert.equal(result.baseMetrics.stockInQuantity, 25);
  assert.equal(result.baseMetrics.stockOutQuantity, 10);
});

test("getMetricDefinitionById maps a stored metric definition row", async () => {
  const result = await getMetricDefinitionById("metric-1", ownerId, {
    selectInventoryOverviewByOwnerId: async () => {
      throw new Error("not used");
    },
    selectInventoryMovementTrendByOwnerId: async () => {
      throw new Error("not used");
    },
    selectInventoryMovementSummaryByOwnerId: async () => {
      throw new Error("not used");
    },
    selectInventoryCategoryBreakdownByOwnerId: async () => {
      throw new Error("not used");
    },
    findOrganizationById: async () => null,
    listMetricDefinitionsByOrgId: async () => [],
    selectMetricDefinitionById: async () => ({
      id: "metric-1",
      org_id: ownerId,
      key: "outflow_ratio",
      name: "Outflow Ratio",
      description: null,
      scope: "organization",
      format: "percent",
      definition_json: { kind: "metric", key: "outboundQuantity" },
      is_active: true,
      created_by: actorId,
      created_at: new Date("2026-04-02T00:00:00.000Z"),
      updated_at: new Date("2026-04-02T00:00:00.000Z"),
    }),
    createMetricDefinition: async () => {
      throw new Error("not used");
    },
    updateMetricDefinition: async () => {
      throw new Error("not used");
    },
    deleteMetricDefinition: async () => {
      throw new Error("not used");
    },
  });

  assert.equal(result?.metric.id, "metric-1");
  assert.equal(result?.metric.key, "outflow_ratio");
});

test("updateMetricDefinitionById updates metric definition fields", async () => {
  let capturedInput: Record<string, unknown> | null = null;

  const result = await updateMetricDefinitionById(
    "metric-1",
    ownerId,
    {
      name: "Updated Outflow Ratio",
      isActive: false,
    },
    {
      selectInventoryOverviewByOwnerId: async () => {
        throw new Error("not used");
      },
      selectInventoryMovementTrendByOwnerId: async () => {
        throw new Error("not used");
      },
      selectInventoryMovementSummaryByOwnerId: async () => {
        throw new Error("not used");
      },
      selectInventoryCategoryBreakdownByOwnerId: async () => {
        throw new Error("not used");
      },
      findOrganizationById: async () => null,
      listMetricDefinitionsByOrgId: async () => [],
      selectMetricDefinitionById: async () => {
        throw new Error("not used");
      },
      createMetricDefinition: async () => {
        throw new Error("not used");
      },
      updateMetricDefinition: async (input) => {
        capturedInput = input;
        return {
          id: "metric-1",
          org_id: ownerId,
          key: "outflow_ratio",
          name: input.name ?? "Outflow Ratio",
          description: null,
          scope: "organization",
          format: "percent",
          definition_json: { kind: "metric", key: "outboundQuantity" },
          is_active: input.isActive ?? true,
          created_by: actorId,
          created_at: new Date("2026-04-02T00:00:00.000Z"),
          updated_at: new Date("2026-04-03T00:00:00.000Z"),
        };
      },
      deleteMetricDefinition: async () => {
        throw new Error("not used");
      },
    },
  );

  assert.deepEqual(capturedInput, {
    metricId: "metric-1",
    orgId: ownerId,
    name: "Updated Outflow Ratio",
    isActive: false,
  });
  assert.equal(result?.metric.name, "Updated Outflow Ratio");
  assert.equal(result?.metric.isActive, false);
});

test("updateMetricDefinitionById rejects semantic division by zero", async () => {
  await assert.rejects(
    () =>
      updateMetricDefinitionById(
        "metric-1",
        ownerId,
        {
          definition: {
            kind: "div",
            left: { kind: "metric", key: "outboundQuantity" },
            right: { kind: "number", value: 0 },
          },
        },
        {
          selectInventoryOverviewByOwnerId: async () => {
            throw new Error("not used");
          },
          selectInventoryMovementTrendByOwnerId: async () => {
            throw new Error("not used");
          },
          selectInventoryMovementSummaryByOwnerId: async () => {
            throw new Error("not used");
          },
          selectInventoryCategoryBreakdownByOwnerId: async () => {
            throw new Error("not used");
          },
          findOrganizationById: async () => null,
          listMetricDefinitionsByOrgId: async () => [],
          selectMetricDefinitionById: async () => null,
          createMetricDefinition: async () => {
            throw new Error("not used");
          },
          updateMetricDefinition: async () => {
            throw new Error("should not update metric definition");
          },
          deleteMetricDefinition: async () => {
            throw new Error("not used");
          },
        },
      ),
    (error: unknown) =>
      error instanceof BadRequestError &&
      error.message.includes("Division by a literal zero is not allowed"),
  );
});

test("deleteMetricDefinitionById maps deleted metric definition rows", async () => {
  const result = await deleteMetricDefinitionById("metric-1", ownerId, {
    selectInventoryOverviewByOwnerId: async () => {
      throw new Error("not used");
    },
    selectInventoryMovementTrendByOwnerId: async () => {
      throw new Error("not used");
    },
    selectInventoryMovementSummaryByOwnerId: async () => {
      throw new Error("not used");
    },
    selectInventoryCategoryBreakdownByOwnerId: async () => {
      throw new Error("not used");
    },
    findOrganizationById: async () => null,
    listMetricDefinitionsByOrgId: async () => [],
    selectMetricDefinitionById: async () => null,
    createMetricDefinition: async () => {
      throw new Error("not used");
    },
    updateMetricDefinition: async () => null,
    deleteMetricDefinition: async () => ({
      id: "metric-1",
      org_id: ownerId,
      key: "outflow_ratio",
      name: "Outflow Ratio",
      description: null,
      scope: "organization",
      format: "percent",
      definition_json: { kind: "metric", key: "outboundQuantity" },
      is_active: true,
      created_by: actorId,
      created_at: new Date("2026-04-02T00:00:00.000Z"),
      updated_at: new Date("2026-04-02T00:00:00.000Z"),
    }),
  });

  assert.equal(result?.metric.id, "metric-1");
  assert.equal(result?.metric.key, "outflow_ratio");
});
