/**
 * Resolves both saved custom metrics and operational inventory analytics used
 * by the dashboard, metrics builder, and alert engine.
 */
import {
  type MetricsFilterOptions,
  selectInventoryCategoryBreakdownByOwnerId,
  selectInventoryMovementTrendByOwnerId,
  selectInventoryMovementSummaryByOwnerId,
  selectInventoryOverviewByOwnerId,
} from "../repositories/metrics.repository.js";
import { findOrganizationById } from "../../organizations/repositories/organizations.repository.js";
import { BASE_METRIC_CATALOG } from "../catalog/base-metrics.catalog.js";
import {
  createMetricDefinition as defaultCreateMetricDefinition,
  listMetricDefinitionsByOrgId as defaultListMetricDefinitionsByOrgId,
  selectMetricDefinitionById as defaultSelectMetricDefinitionById,
  updateMetricDefinition as defaultUpdateMetricDefinition,
  deleteMetricDefinition as defaultDeleteMetricDefinition,
} from "../repositories/metric-definitions.repository.js";
import {
  evaluateMetricDefinition,
  validateMetricDefinitionSemantics,
  type MetricDefinitionNode,
} from "../../../shared/definition-engine/index.js";
import type {
  InventoryCategoryBreakdownRow,
  InventoryMovementTrendRow,
  InventoryMovementSummaryRow,
  InventoryOverviewRow,
} from "../types/metrics.db.types.js";
import type {
  BaseMetricCatalogEntry,
  MetricDefinition,
  MetricDefinitionRow,
} from "../types/metric-definition.types.js";
import { BadRequestError } from "../../../types/http-error.types.js";

type MetricsServiceDependencies = {
  selectInventoryOverviewByOwnerId: (
    ownerId: string,
    options?: MetricsFilterOptions,
  ) => Promise<InventoryOverviewRow>;
  selectInventoryMovementTrendByOwnerId: (
    ownerId: string,
    days: number,
    options?: MetricsFilterOptions,
  ) => Promise<InventoryMovementTrendRow[]>;
  selectInventoryMovementSummaryByOwnerId: (
    ownerId: string,
    options?: MetricsFilterOptions & {
      days?: number;
    },
  ) => Promise<InventoryMovementSummaryRow>;
  selectInventoryCategoryBreakdownByOwnerId: (
    ownerId: string,
    options?: MetricsFilterOptions,
  ) => Promise<InventoryCategoryBreakdownRow[]>;
  findOrganizationById: (orgId: string) => Promise<{
    id: string;
    name: string | null;
    critical_stock_threshold: number;
    low_stock_threshold: number;
  } | null>;
  listMetricDefinitionsByOrgId: (orgId: string) => Promise<MetricDefinitionRow[]>;
  selectMetricDefinitionById: (
    metricId: string,
    orgId: string,
  ) => Promise<MetricDefinitionRow | null>;
  createMetricDefinition: (input: {
    orgId: string;
    key: string;
    name: string;
    description?: string | null;
    scope: "organization" | "product" | "category";
    format: "number" | "percent" | "currency" | "quantity";
    definition: unknown;
    createdBy: string;
  }) => Promise<MetricDefinitionRow>;
  updateMetricDefinition: (input: {
    metricId: string;
    orgId: string;
    key?: string | undefined;
    name?: string | undefined;
    description?: string | null | undefined;
    scope?: "organization" | "product" | "category" | undefined;
    format?: "number" | "percent" | "currency" | "quantity" | undefined;
    definition?: unknown | undefined;
    isActive?: boolean | undefined;
  }) => Promise<MetricDefinitionRow | null>;
  deleteMetricDefinition: (
    metricId: string,
    orgId: string,
  ) => Promise<MetricDefinitionRow | null>;
};

const metricsServiceDependencies: MetricsServiceDependencies = {
  selectInventoryOverviewByOwnerId,
  selectInventoryMovementTrendByOwnerId,
  selectInventoryMovementSummaryByOwnerId,
  selectInventoryCategoryBreakdownByOwnerId,
  findOrganizationById,
  listMetricDefinitionsByOrgId: defaultListMetricDefinitionsByOrgId,
  selectMetricDefinitionById: defaultSelectMetricDefinitionById,
  createMetricDefinition: defaultCreateMetricDefinition,
  updateMetricDefinition: defaultUpdateMetricDefinition,
  deleteMetricDefinition: defaultDeleteMetricDefinition,
};

export type InventoryOverviewMetrics = {
  totalSku: number;
  totalQuantity: number;
  totalValue: number;
  criticalCount: number;
  lowCount: number;
};

export type InventoryMovementTrendPoint = {
  bucket: string;
  inbound: number;
  outbound: number;
};

export type InventoryCategoryBreakdownEntry = {
  categoryId: string | null;
  categoryName: string;
  skuCount: number;
  totalQuantity: number;
  totalValue: number;
  share: number;
};

export type InventoryMovementSummaryMetrics = {
  movementCount: number;
  stockInQuantity: number;
  stockOutQuantity: number;
  transferInQuantity: number;
  transferOutQuantity: number;
  adjustmentIncreaseQuantity: number;
  adjustmentDecreaseQuantity: number;
  inboundQuantity: number;
  outboundQuantity: number;
  netQuantity: number;
};

function mapMetricDefinitionRow(row: MetricDefinitionRow): MetricDefinition {
  return {
    id: row.id,
    orgId: row.org_id,
    key: row.key,
    name: row.name,
    description: row.description,
    scope: row.scope,
    format: row.format,
    definition: row.definition_json,
    isActive: row.is_active,
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

/**
 * Returns the static catalog of built-in metrics that custom metric
 * definitions may reference.
 */
export function getBaseMetricCatalog(): { metrics: readonly BaseMetricCatalogEntry[] } {
  return { metrics: BASE_METRIC_CATALOG };
}

/**
 * Lists saved custom metric definitions for the current organization.
 */
export async function listMetricDefinitionsForOrganization(
  ownerId: string,
  dependencies: MetricsServiceDependencies = metricsServiceDependencies,
): Promise<{ metrics: MetricDefinition[] }> {
  const rows = await dependencies.listMetricDefinitionsByOrgId(ownerId);
  return {
    metrics: rows.map(mapMetricDefinitionRow),
  };
}

/**
 * Validates and persists a new custom metric definition.
 */
export async function createMetricDefinitionForOrganization(
  ownerId: string,
  actorId: string,
  input: {
    key: string;
    name: string;
    description?: string | null;
    scope: "organization" | "product" | "category";
    format: "number" | "percent" | "currency" | "quantity";
    definition: unknown;
  },
  dependencies: MetricsServiceDependencies = metricsServiceDependencies,
): Promise<{ metric: MetricDefinition }> {
  const semanticIssues = validateMetricDefinitionSemantics(
    input.definition as MetricDefinitionNode,
  );

  if (semanticIssues.length > 0) {
    throw new BadRequestError(
      `Invalid metric definition semantics: ${semanticIssues
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join("; ")}`,
    );
  }

  const row = await dependencies.createMetricDefinition({
    orgId: ownerId,
    key: input.key,
    name: input.name,
    scope: input.scope,
    format: input.format,
    definition: input.definition,
    createdBy: actorId,
    ...(input.description !== undefined
      ? { description: input.description }
      : {}),
  });

  return {
    metric: mapMetricDefinitionRow(row),
  };
}

/**
 * Returns a single saved metric definition when it belongs to the caller's
 * organization.
 */
export async function getMetricDefinitionById(
  metricId: string,
  ownerId: string,
  dependencies: MetricsServiceDependencies = metricsServiceDependencies,
): Promise<{ metric: MetricDefinition } | null> {
  const row = await dependencies.selectMetricDefinitionById(metricId, ownerId);

  if (!row) {
    return null;
  }

  return {
    metric: mapMetricDefinitionRow(row),
  };
}

/**
 * Updates an existing metric definition and re-runs semantic validation when
 * the definition tree changes.
 */
export async function updateMetricDefinitionById(
  metricId: string,
  ownerId: string,
  input: {
    key?: string | undefined;
    name?: string | undefined;
    description?: string | null | undefined;
    scope?: "organization" | "product" | "category" | undefined;
    format?: "number" | "percent" | "currency" | "quantity" | undefined;
    definition?: unknown | undefined;
    isActive?: boolean | undefined;
  },
  dependencies: MetricsServiceDependencies = metricsServiceDependencies,
): Promise<{ metric: MetricDefinition } | null> {
  if (input.definition !== undefined) {
    const semanticIssues = validateMetricDefinitionSemantics(
      input.definition as MetricDefinitionNode,
    );

    if (semanticIssues.length > 0) {
      throw new BadRequestError(
        `Invalid metric definition semantics: ${semanticIssues
          .map((issue) => `${issue.path}: ${issue.message}`)
          .join("; ")}`,
      );
    }
  }

  const row = await dependencies.updateMetricDefinition({
    metricId,
    orgId: ownerId,
    ...(input.key !== undefined ? { key: input.key } : {}),
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.scope !== undefined ? { scope: input.scope } : {}),
    ...(input.format !== undefined ? { format: input.format } : {}),
    ...(input.definition !== undefined ? { definition: input.definition } : {}),
    ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
  });

  if (!row) {
    return null;
  }

  return {
    metric: mapMetricDefinitionRow(row),
  };
}

/**
 * Deletes a saved metric definition.
 */
export async function deleteMetricDefinitionById(
  metricId: string,
  ownerId: string,
  dependencies: MetricsServiceDependencies = metricsServiceDependencies,
): Promise<{ metric: MetricDefinition } | null> {
  const row = await dependencies.deleteMetricDefinition(metricId, ownerId);

  if (!row) {
    return null;
  }

  return {
    metric: mapMetricDefinitionRow(row),
  };
}

/**
 * Evaluates an unsaved metric definition against the organization's current
 * metric context so builders can preview formulas before persisting them.
 */
export async function previewMetricDefinitionForOrganization(
  ownerId: string,
  input: {
    definition: MetricDefinitionNode;
    filters?: MetricsFilterOptions & { days?: number };
  },
  dependencies: MetricsServiceDependencies = metricsServiceDependencies,
): Promise<{
  preview: {
    status: "ready" | "stub";
    value: number | null;
    reason?: string;
  };
  baseMetrics: Record<string, number>;
}> {
  const semanticIssues = validateMetricDefinitionSemantics(input.definition);

  if (semanticIssues.length > 0) {
    throw new BadRequestError(
      `Invalid metric definition semantics: ${semanticIssues
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join("; ")}`,
    );
  }

  const filters = input.filters ?? {};
  const [overview, movementSummary] = await Promise.all([
    getInventoryOverviewMetrics(ownerId, filters, dependencies),
    getInventoryMovementSummaryMetrics(ownerId, filters, dependencies),
  ]);

  const baseMetrics = {
    totalSku: overview.totalSku,
    totalQuantity: overview.totalQuantity,
    totalValue: overview.totalValue,
    criticalCount: overview.criticalCount,
    lowCount: overview.lowCount,
    movementCount: movementSummary.summary.movementCount,
    stockInQuantity: movementSummary.summary.stockInQuantity,
    stockOutQuantity: movementSummary.summary.stockOutQuantity,
    transferInQuantity: movementSummary.summary.transferInQuantity,
    transferOutQuantity: movementSummary.summary.transferOutQuantity,
    adjustmentIncreaseQuantity: movementSummary.summary.adjustmentIncreaseQuantity,
    adjustmentDecreaseQuantity: movementSummary.summary.adjustmentDecreaseQuantity,
    inboundQuantity: movementSummary.summary.inboundQuantity,
    outboundQuantity: movementSummary.summary.outboundQuantity,
    netQuantity: movementSummary.summary.netQuantity,
  };

  return {
    preview: evaluateMetricDefinition({
      definition: input.definition,
      scope: {
        orgId: ownerId,
        ...(filters.productId ? { productId: filters.productId } : {}),
      },
      baseMetrics,
    }),
    baseMetrics,
  };
}

/**
 * Resolves the current values for all built-in metrics used by the definition
 * engine and dashboard analytics.
 */
export async function resolveBaseMetricValuesForOrganization(
  ownerId: string,
  filters: MetricsFilterOptions & { days?: number } = {},
  dependencies: MetricsServiceDependencies = metricsServiceDependencies,
): Promise<Record<string, number>> {
  const [overview, movementSummary] = await Promise.all([
    getInventoryOverviewMetrics(ownerId, filters, dependencies),
    getInventoryMovementSummaryMetrics(ownerId, filters, dependencies),
  ]);

  return {
    totalSku: overview.totalSku,
    totalQuantity: overview.totalQuantity,
    totalValue: overview.totalValue,
    criticalCount: overview.criticalCount,
    lowCount: overview.lowCount,
    movementCount: movementSummary.summary.movementCount,
    stockInQuantity: movementSummary.summary.stockInQuantity,
    stockOutQuantity: movementSummary.summary.stockOutQuantity,
    transferInQuantity: movementSummary.summary.transferInQuantity,
    transferOutQuantity: movementSummary.summary.transferOutQuantity,
    adjustmentIncreaseQuantity: movementSummary.summary.adjustmentIncreaseQuantity,
    adjustmentDecreaseQuantity: movementSummary.summary.adjustmentDecreaseQuantity,
    inboundQuantity: movementSummary.summary.inboundQuantity,
    outboundQuantity: movementSummary.summary.outboundQuantity,
    netQuantity: movementSummary.summary.netQuantity,
  };
}

/**
 * Resolves active custom metric definitions on top of the base-metric context.
 */
export async function resolveCustomMetricValuesForOrganization(
  ownerId: string,
  filters: MetricsFilterOptions & { days?: number } = {},
  dependencies: MetricsServiceDependencies = metricsServiceDependencies,
): Promise<Record<string, number>> {
  const baseMetrics = await resolveBaseMetricValuesForOrganization(
    ownerId,
    filters,
    dependencies,
  );
  const definitionRows = await dependencies.listMetricDefinitionsByOrgId(ownerId);
  const activeDefinitions = definitionRows.filter((row) => row.is_active);

  const entries = activeDefinitions.map((row) => {
    const result = evaluateMetricDefinition({
      definition: row.definition_json as MetricDefinitionNode,
      scope: {
        orgId: ownerId,
        ...(filters.productId ? { productId: filters.productId } : {}),
      },
      baseMetrics,
    });

    if (result.value === null) {
      throw new BadRequestError(
        result.reason ?? `Custom metric "${row.key}" could not be evaluated`,
      );
    }

    return [row.key, result.value] as const;
  });

  return Object.fromEntries(entries);
}

function toMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function toIsoDate(value: Date | string): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return value;
}

async function resolveMetricsFilterOptions(
  ownerId: string,
  options: MetricsFilterOptions,
  dependencies: MetricsServiceDependencies,
): Promise<MetricsFilterOptions> {
  if (
    options.criticalThreshold !== undefined &&
    options.lowThreshold !== undefined
  ) {
    return options;
  }

  const organization = await dependencies.findOrganizationById(ownerId);

  return {
    ...options,
    criticalThreshold:
      options.criticalThreshold ??
      organization?.critical_stock_threshold ??
      10,
    lowThreshold:
      options.lowThreshold ??
      organization?.low_stock_threshold ??
      25,
  };
}

/**
 * Returns the top-level inventory snapshot used by the dashboard and metrics
 * overview cards.
 */
export async function getInventoryOverviewMetrics(
  ownerId: string,
  options: MetricsFilterOptions = {},
  dependencies: MetricsServiceDependencies = metricsServiceDependencies,
): Promise<InventoryOverviewMetrics> {
  const resolvedOptions = await resolveMetricsFilterOptions(
    ownerId,
    options,
    dependencies,
  );
  const row = await dependencies.selectInventoryOverviewByOwnerId(
    ownerId,
    resolvedOptions,
  );

  return {
    totalSku: Number(row.total_sku),
    totalQuantity: Number(row.total_quantity),
    totalValue: toMoney(Number(row.total_value)),
    criticalCount: Number(row.critical_count),
    lowCount: Number(row.low_count),
  };
}

/**
 * Returns bucketed inbound/outbound history for the requested time window.
 */
export async function getInventoryMovementTrendMetrics(
  ownerId: string,
  days: number,
  options: MetricsFilterOptions = {},
  dependencies: MetricsServiceDependencies = metricsServiceDependencies,
): Promise<{ days: number; trend: InventoryMovementTrendPoint[] }> {
  const resolvedOptions = await resolveMetricsFilterOptions(
    ownerId,
    options,
    dependencies,
  );
  const rows = await dependencies.selectInventoryMovementTrendByOwnerId(
    ownerId,
    days,
    resolvedOptions,
  );

  return {
    days,
    trend: rows.map((row) => ({
      bucket: toIsoDate(row.bucket_date),
      inbound: Number(row.inbound_quantity),
      outbound: Number(row.outbound_quantity),
    })),
  };
}

/**
 * Returns the current quantity/value split by category for breakdown charts.
 */
export async function getInventoryCategoryBreakdownMetrics(
  ownerId: string,
  top: number,
  options: MetricsFilterOptions = {},
  dependencies: MetricsServiceDependencies = metricsServiceDependencies,
): Promise<{ categories: InventoryCategoryBreakdownEntry[] }> {
  const resolvedOptions = await resolveMetricsFilterOptions(
    ownerId,
    options,
    dependencies,
  );
  const rows = await dependencies.selectInventoryCategoryBreakdownByOwnerId(
    ownerId,
    resolvedOptions,
  );

  const totalValue = rows.reduce(
    (sum, row) => sum + Number(row.total_value),
    0,
  );

  if (rows.length === 0) {
    return { categories: [] };
  }

  const mapped = rows.map((row) => ({
    categoryId: row.category_id,
    categoryName: row.category_name,
    skuCount: Number(row.sku_count),
    totalQuantity: Number(row.total_quantity),
    totalValue: toMoney(Number(row.total_value)),
    share:
      totalValue > 0
        ? Math.round((Number(row.total_value) / totalValue) * 10000) / 100
        : 0,
  }));

  if (mapped.length <= top) {
    return { categories: mapped };
  }

  const visible = mapped.slice(0, top);
  const remainder = mapped.slice(top);
  const otherValue = remainder.reduce((sum, entry) => sum + entry.totalValue, 0);
  const otherQuantity = remainder.reduce(
    (sum, entry) => sum + entry.totalQuantity,
    0,
  );
  const otherSkuCount = remainder.reduce((sum, entry) => sum + entry.skuCount, 0);

  return {
    categories: [
      ...visible,
      {
        categoryId: null,
        categoryName: "Other",
        skuCount: otherSkuCount,
        totalQuantity: otherQuantity,
        totalValue: toMoney(otherValue),
        share:
          totalValue > 0 ? Math.round((otherValue / totalValue) * 10000) / 100 : 0,
      },
    ],
  };
}

/**
 * Returns aggregate movement totals for a time window, used by turnover and
 * alert-related summary calculations.
 */
export async function getInventoryMovementSummaryMetrics(
  ownerId: string,
  options: MetricsFilterOptions & {
    days?: number;
  } = {},
  dependencies: MetricsServiceDependencies = metricsServiceDependencies,
): Promise<{
  scope: { productId: string | null; days: number | null };
  summary: InventoryMovementSummaryMetrics;
}> {
  const resolvedOptions = await resolveMetricsFilterOptions(
    ownerId,
    options,
    dependencies,
  );
  const row = await dependencies.selectInventoryMovementSummaryByOwnerId(
    ownerId,
    {
      ...resolvedOptions,
      ...(options.days !== undefined ? { days: options.days } : {}),
    },
  );

  const stockInQuantity = Number(row.stock_in_quantity);
  const stockOutQuantity = Number(row.stock_out_quantity);
  const transferInQuantity = Number(row.transfer_in_quantity);
  const transferOutQuantity = Number(row.transfer_out_quantity);
  const adjustmentIncreaseQuantity = Number(row.adjustment_increase_quantity);
  const adjustmentDecreaseQuantity = Number(row.adjustment_decrease_quantity);
  const inboundQuantity =
    stockInQuantity + transferInQuantity + adjustmentIncreaseQuantity;
  const outboundQuantity =
    stockOutQuantity + transferOutQuantity + adjustmentDecreaseQuantity;

  return {
    scope: {
      productId: options.productId ?? null,
      days: options.days ?? null,
    },
    summary: {
      movementCount: Number(row.movement_count),
      stockInQuantity,
      stockOutQuantity,
      transferInQuantity,
      transferOutQuantity,
      adjustmentIncreaseQuantity,
      adjustmentDecreaseQuantity,
      inboundQuantity,
      outboundQuantity,
      netQuantity: inboundQuantity - outboundQuantity,
    },
  };
}
