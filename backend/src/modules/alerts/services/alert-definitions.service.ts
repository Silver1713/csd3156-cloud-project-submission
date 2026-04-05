import {
  createAlertDefinition as defaultCreateAlertDefinition,
  deleteAlertDefinition as defaultDeleteAlertDefinition,
  listAlertDefinitionsByOrgId as defaultListAlertDefinitionsByOrgId,
  selectAlertDefinitionById as defaultSelectAlertDefinitionById,
  updateAlertDefinition as defaultUpdateAlertDefinition,
} from "../repositories/alert-definitions.repository.js";
import { listMetricDefinitionsByOrgId as defaultListMetricDefinitionsByOrgId } from "../../metrics/repositories/metric-definitions.repository.js";
import {
  resolveBaseMetricValuesForOrganization,
  resolveCustomMetricValuesForOrganization,
} from "../../metrics/services/metrics.service.js";
import type {
  CreateAlertDefinitionDto,
  PreviewAlertDefinitionDto,
  UpdateAlertDefinitionDto,
} from "../dto/alert-definitions.dto.js";
import type {
  AlertDefinition,
  AlertDefinitionRow,
} from "../types/alert-definition.types.js";
import type { MetricDefinitionRow } from "../../metrics/types/metric-definition.types.js";
import {
  evaluateAlertDefinition,
  validateAlertDefinitionSemantics,
  type AlertConditionNode,
} from "../../../shared/definition-engine/index.js";
import { BadRequestError } from "../../../types/http-error.types.js";

type AlertDefinitionsServiceDependencies = {
  listAlertDefinitionsByOrgId: typeof defaultListAlertDefinitionsByOrgId;
  selectAlertDefinitionById: typeof defaultSelectAlertDefinitionById;
  createAlertDefinition: typeof defaultCreateAlertDefinition;
  updateAlertDefinition: typeof defaultUpdateAlertDefinition;
  deleteAlertDefinition: typeof defaultDeleteAlertDefinition;
  listMetricDefinitionsByOrgId: (orgId: string) => Promise<MetricDefinitionRow[]>;
};

const defaultDependencies: AlertDefinitionsServiceDependencies = {
  listAlertDefinitionsByOrgId: defaultListAlertDefinitionsByOrgId,
  selectAlertDefinitionById: defaultSelectAlertDefinitionById,
  createAlertDefinition: defaultCreateAlertDefinition,
  updateAlertDefinition: defaultUpdateAlertDefinition,
  deleteAlertDefinition: defaultDeleteAlertDefinition,
  listMetricDefinitionsByOrgId: defaultListMetricDefinitionsByOrgId,
};

function mapAlertDefinitionRow(row: AlertDefinitionRow): AlertDefinition {
  return {
    id: row.id,
    orgId: row.org_id,
    key: row.key,
    name: row.name,
    description: row.description,
    severity: row.severity,
    scope: row.scope,
    condition: row.condition_json,
    isActive: row.is_active,
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

async function assertAlertDefinitionSemantics(input: {
  orgId: string;
  scope: "organization" | "product" | "category";
  condition: AlertConditionNode;
  dependencies: AlertDefinitionsServiceDependencies;
}): Promise<void> {
  const metricDefinitions = await input.dependencies.listMetricDefinitionsByOrgId(
    input.orgId,
  );

  const semanticIssues = validateAlertDefinitionSemantics({
    scope: input.scope,
    condition: input.condition,
    availableCustomMetrics: metricDefinitions.map((entry) => ({
      key: entry.key,
      scope: entry.scope,
      isActive: entry.is_active,
    })),
  });

  if (semanticIssues.length > 0) {
    throw new BadRequestError(
      `Invalid alert definition semantics: ${semanticIssues
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join("; ")}`,
    );
  }
}

export async function listAlertDefinitionsForOrganization(
  ownerId: string,
  dependencies: AlertDefinitionsServiceDependencies = defaultDependencies,
): Promise<{ alertDefinitions: AlertDefinition[] }> {
  const rows = await dependencies.listAlertDefinitionsByOrgId(ownerId);
  return {
    alertDefinitions: rows.map(mapAlertDefinitionRow),
  };
}

export async function getAlertDefinitionById(
  alertDefinitionId: string,
  ownerId: string,
  dependencies: AlertDefinitionsServiceDependencies = defaultDependencies,
): Promise<{ alertDefinition: AlertDefinition } | null> {
  const row = await dependencies.selectAlertDefinitionById(
    alertDefinitionId,
    ownerId,
  );
  return row ? { alertDefinition: mapAlertDefinitionRow(row) } : null;
}

export async function createAlertDefinitionForOrganization(
  ownerId: string,
  actorId: string,
  input: CreateAlertDefinitionDto,
  dependencies: AlertDefinitionsServiceDependencies = defaultDependencies,
): Promise<{ alertDefinition: AlertDefinition; engineStatus: "stub" }> {
  await assertAlertDefinitionSemantics({
    orgId: ownerId,
    scope: input.scope,
    condition: input.condition as AlertConditionNode,
    dependencies,
  });

  const row = await dependencies.createAlertDefinition({
    orgId: ownerId,
    key: input.key,
    name: input.name,
    severity: input.severity,
    scope: input.scope,
    condition: input.condition,
    createdBy: actorId,
    ...(input.description !== undefined ? { description: input.description } : {}),
  });

  return {
    alertDefinition: mapAlertDefinitionRow(row),
    engineStatus: "stub",
  };
}

export async function updateAlertDefinitionById(
  alertDefinitionId: string,
  ownerId: string,
  input: UpdateAlertDefinitionDto,
  dependencies: AlertDefinitionsServiceDependencies = defaultDependencies,
): Promise<{ alertDefinition: AlertDefinition; engineStatus: "stub" } | null> {
  const existing = await dependencies.selectAlertDefinitionById(
    alertDefinitionId,
    ownerId,
  );

  if (!existing) {
    return null;
  }

  const resolvedScope = input.scope ?? existing.scope;
  const resolvedCondition =
    (input.condition as AlertConditionNode | undefined) ??
    (existing.condition_json as AlertConditionNode);

  await assertAlertDefinitionSemantics({
    orgId: ownerId,
    scope: resolvedScope,
    condition: resolvedCondition,
    dependencies,
  });

  const row = await dependencies.updateAlertDefinition({
    alertDefinitionId,
    orgId: ownerId,
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.severity !== undefined ? { severity: input.severity } : {}),
    ...(input.scope !== undefined ? { scope: input.scope } : {}),
    ...(input.condition !== undefined ? { condition: input.condition } : {}),
    ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
  });

  return row
    ? {
        alertDefinition: mapAlertDefinitionRow(row),
        engineStatus: "stub",
      }
    : null;
}

export async function deleteAlertDefinitionById(
  alertDefinitionId: string,
  ownerId: string,
  dependencies: AlertDefinitionsServiceDependencies = defaultDependencies,
): Promise<{ alertDefinition: AlertDefinition } | null> {
  const row = await dependencies.deleteAlertDefinition(alertDefinitionId, ownerId);
  return row ? { alertDefinition: mapAlertDefinitionRow(row) } : null;
}

export async function previewAlertDefinitionForOrganization(
  ownerId: string,
  input: PreviewAlertDefinitionDto,
  dependencies: AlertDefinitionsServiceDependencies = defaultDependencies,
): Promise<{
  preview: {
    status: "ready" | "stub";
    triggered: boolean | null;
    reason?: string;
  };
  baseMetrics: Record<string, number>;
  customMetrics: Record<string, number>;
}> {
  await assertAlertDefinitionSemantics({
    orgId: ownerId,
    scope: input.scope,
    condition: input.condition,
    dependencies,
  });

  const filters = input.filters
    ? {
        ...(input.filters.q ? { q: input.filters.q } : {}),
        ...(input.filters.productId ? { productId: input.filters.productId } : {}),
        ...(input.filters.categoryIds ? { categoryIds: input.filters.categoryIds } : {}),
        ...(input.filters.stockState ? { stockState: input.filters.stockState } : {}),
        ...(input.filters.criticalThreshold !== undefined
          ? { criticalThreshold: input.filters.criticalThreshold }
          : {}),
        ...(input.filters.lowThreshold !== undefined
          ? { lowThreshold: input.filters.lowThreshold }
          : {}),
        ...(input.filters.days !== undefined ? { days: input.filters.days } : {}),
      }
    : {};
  const [baseMetrics, customMetrics] = await Promise.all([
    resolveBaseMetricValuesForOrganization(ownerId, filters),
    resolveCustomMetricValuesForOrganization(ownerId, filters),
  ]);

  return {
    preview: evaluateAlertDefinition({
      condition: input.condition,
      scope: {
        orgId: ownerId,
        ...(filters.productId ? { productId: filters.productId } : {}),
      },
      baseMetrics,
      customMetrics,
    }),
    baseMetrics,
    customMetrics,
  };
}
