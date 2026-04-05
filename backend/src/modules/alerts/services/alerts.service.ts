/**
 * Serves alert records and keeps generated definition-backed alerts in sync
 * with the current metric state before listing them to clients.
 */
import {
  listActiveAlertDefinitionsByOrgId,
} from "../repositories/alert-definitions.repository.js";
import {
  countAlertsByOwnerId,
  deleteAlert,
  insertAlert,
  selectOpenAlertByDefinitionId,
  selectAlertById,
  selectAlertsByOwnerId,
  updateAlert,
} from "../repositories/alerts.repository.js";
import {
  resolveBaseMetricValuesForOrganization,
  resolveCustomMetricValuesForOrganization,
} from "../../metrics/services/metrics.service.js";
import {
  evaluateAlertDefinition,
  type AlertConditionNode,
} from "../../../shared/definition-engine/index.js";
import { BadRequestError } from "../../../types/http-error.types.js";
import type {
  CreateAlertDto,
  ListAlertsQueryDto,
  UpdateAlertDto,
} from "../dto/alerts.dto.js";
import type { AlertListResult, PublicAlert } from "../types/alerts.account.types.js";
import type { AlertListQuery, AlertRow } from "../types/alerts.db.types.js";
import type { AlertDefinitionRow } from "../types/alert-definition.types.js";

type AlertsServiceDependencies = {
  listActiveAlertDefinitionsByOrgId: (orgId: string) => Promise<AlertDefinitionRow[]>;
  selectAlertsByOwnerId: (query: AlertListQuery) => Promise<AlertRow[]>;
  countAlertsByOwnerId: (
    query: Omit<AlertListQuery, "limit" | "offset">,
  ) => Promise<number>;
  selectAlertById: (alertId: string, ownerId: string) => Promise<AlertRow | null>;
  selectOpenAlertByDefinitionId: (
    ownerId: string,
    alertDefinitionId: string,
  ) => Promise<AlertRow | null>;
  insertAlert: typeof insertAlert;
  updateAlert: typeof updateAlert;
  deleteAlert: typeof deleteAlert;
};

const defaultDependencies: AlertsServiceDependencies = {
  listActiveAlertDefinitionsByOrgId,
  selectAlertsByOwnerId,
  countAlertsByOwnerId,
  selectAlertById,
  selectOpenAlertByDefinitionId,
  insertAlert,
  updateAlert,
  deleteAlert,
};

function extractSimpleComparisonValues(
  condition: AlertConditionNode,
  metricValues: Record<string, number>,
): { currentQuantity: number | null; thresholdQuantity: number | null } {
  if (condition.kind !== "comparison") {
    return { currentQuantity: null, thresholdQuantity: null };
  }

  const leftValue =
    condition.left.kind === "metric"
      ? metricValues[condition.left.key]
      : condition.left.value;
  const rightValue =
    condition.right.kind === "metric"
      ? metricValues[condition.right.key]
      : condition.right.value;

  const currentQuantity =
    condition.left.kind === "metric"
      ? leftValue
      : condition.right.kind === "metric"
        ? rightValue
        : null;
  const thresholdQuantity =
    condition.left.kind === "number"
      ? leftValue
      : condition.right.kind === "number"
        ? rightValue
        : null;

  return {
    currentQuantity:
      typeof currentQuantity === "number" && Number.isFinite(currentQuantity)
        ? currentQuantity
        : null,
    thresholdQuantity:
      typeof thresholdQuantity === "number" && Number.isFinite(thresholdQuantity)
        ? thresholdQuantity
        : null,
  };
}

function buildGeneratedAlertMessage(
  definition: AlertDefinitionRow,
  currentQuantity: number | null,
  thresholdQuantity: number | null,
): string {
  if (currentQuantity !== null && thresholdQuantity !== null) {
    return `${definition.name} triggered: current value ${currentQuantity} compared with threshold ${thresholdQuantity}.`;
  }

  return `${definition.name} triggered from a saved ${definition.scope} alert definition.`;
}

async function syncAlertDefinitionsForOrganization(
  ownerId: string,
  dependencies: AlertsServiceDependencies,
): Promise<void> {
  const definitions = await dependencies.listActiveAlertDefinitionsByOrgId(ownerId);

  if (definitions.length === 0) {
    return;
  }

  const [baseMetrics, customMetrics] = await Promise.all([
    resolveBaseMetricValuesForOrganization(ownerId),
    resolveCustomMetricValuesForOrganization(ownerId),
  ]);

  const metricValues = {
    ...baseMetrics,
    ...customMetrics,
  };

  await Promise.all(
    definitions.map(async (definition) => {
      const evaluation = evaluateAlertDefinition({
        condition: definition.condition_json as AlertConditionNode,
        scope: { orgId: ownerId },
        baseMetrics,
        customMetrics,
      });

      const existing = await dependencies.selectOpenAlertByDefinitionId(
        ownerId,
        definition.id,
      );

      if (evaluation.triggered !== true) {
        if (existing && existing.status !== "resolved") {
          await dependencies.updateAlert({
            alertId: existing.id,
            ownerId,
            status: "resolved",
            currentQuantity: null,
            message:
              evaluation.reason ??
              `${definition.name} resolved because the condition is no longer true.`,
          });
        }

        return;
      }

      const { currentQuantity, thresholdQuantity } = extractSimpleComparisonValues(
        definition.condition_json as AlertConditionNode,
        metricValues,
      );
      const message = buildGeneratedAlertMessage(
        definition,
        currentQuantity,
        thresholdQuantity,
      );

      if (existing) {
        await dependencies.updateAlert({
          alertId: existing.id,
          ownerId,
          currentQuantity,
          thresholdQuantity,
          message,
        });
        return;
      }

      await dependencies.insertAlert({
        ownerId,
        productId: null,
        alertDefinitionId: definition.id,
        type: "custom",
        status: "active",
        currentQuantity,
        thresholdQuantity,
        message,
      });
    }),
  );
}

function mapAlertRowToPublicAlert(row: AlertRow): PublicAlert {
  return {
    id: row.id,
    ownerId: row.owner_id,
    productId: row.product_id,
    productName: row.product_name,
    productSku: row.product_sku,
    triggeredByMovementId: row.triggered_by_movement_id,
    alertDefinitionId: row.alert_definition_id,
    type: row.type,
    status: row.status,
    thresholdQuantity: row.threshold_quantity,
    currentQuantity: row.current_quantity,
    message: row.message,
    acknowledgedBy: row.acknowledged_by
      ? {
          id: row.acknowledged_by,
          name: row.acknowledged_by_name,
          username: row.acknowledged_by_username,
        }
      : null,
    acknowledgedAt: row.acknowledged_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
  };
}

function buildAlertListQuery(
  ownerId: string,
  command: ListAlertsQueryDto,
): AlertListQuery {
  const queryInput: AlertListQuery = {
    ownerId,
    limit: command.limit,
    offset: command.offset,
  };

  if (command.status) {
    queryInput.status = command.status;
  }

  if (command.type) {
    queryInput.type = command.type;
  }

  if (command.productId) {
    queryInput.productId = command.productId;
  }

  return queryInput;
}

function buildAlertCountQuery(
  queryInput: AlertListQuery,
): Omit<AlertListQuery, "limit" | "offset"> {
  const countQuery: Omit<AlertListQuery, "limit" | "offset"> = {
    ownerId: queryInput.ownerId,
  };

  if (queryInput.status) {
    countQuery.status = queryInput.status;
  }

  if (queryInput.type) {
    countQuery.type = queryInput.type;
  }

  if (queryInput.productId) {
    countQuery.productId = queryInput.productId;
  }

  return countQuery;
}

/**
 * Lists alerts for the current organization after first reconciling any active
 * alert definitions into concrete alert records.
 */
export async function listAlerts(
  ownerId: string,
  command: ListAlertsQueryDto,
  dependencies: AlertsServiceDependencies = defaultDependencies,
): Promise<AlertListResult> {
  await syncAlertDefinitionsForOrganization(ownerId, dependencies);

  const queryInput = buildAlertListQuery(ownerId, command);
  const [rows, total] = await Promise.all([
    dependencies.selectAlertsByOwnerId(queryInput),
    dependencies.countAlertsByOwnerId(buildAlertCountQuery(queryInput)),
  ]);

  return {
    alerts: rows.map(mapAlertRowToPublicAlert),
    pagination: {
      limit: command.limit,
      offset: command.offset,
      total,
      hasMore: command.offset + rows.length < total,
    },
  };
}

/**
 * Returns a single alert when it belongs to the caller's organization.
 */
export async function getAlertById(
  alertId: string,
  ownerId: string,
  dependencies: AlertsServiceDependencies = defaultDependencies,
): Promise<PublicAlert | null> {
  const row = await dependencies.selectAlertById(alertId, ownerId);
  return row ? mapAlertRowToPublicAlert(row) : null;
}

/**
 * Creates a manual alert record.
 */
export async function createAlert(
  ownerId: string,
  command: CreateAlertDto,
  dependencies: AlertsServiceDependencies = defaultDependencies,
): Promise<PublicAlert> {
  if (!command.productId && !(command.type === "custom" && command.alertDefinitionId)) {
    throw new BadRequestError(
      "productId is required unless this is a custom alert linked to an alert definition",
    );
  }

  if (command.alertDefinitionId && command.type !== "custom") {
    throw new BadRequestError("alertDefinitionId can only be used with custom alerts");
  }

  const row = await dependencies.insertAlert({
    ownerId,
    productId: command.productId ?? null,
    triggeredByMovementId: command.triggeredByMovementId ?? null,
    alertDefinitionId: command.alertDefinitionId ?? null,
    type: command.type,
    status: command.status,
    thresholdQuantity: command.thresholdQuantity ?? null,
    currentQuantity: command.currentQuantity ?? null,
    message: command.message ?? null,
  });

  return mapAlertRowToPublicAlert(row);
}

/**
 * Updates mutable alert fields such as status or note content.
 */
export async function updateAlertById(
  alertId: string,
  ownerId: string,
  actorId: string,
  command: UpdateAlertDto,
  dependencies: AlertsServiceDependencies = defaultDependencies,
): Promise<PublicAlert | null> {
  const row = await dependencies.updateAlert({
    alertId,
    ownerId,
    status: command.status,
    thresholdQuantity: command.thresholdQuantity,
    currentQuantity: command.currentQuantity,
    message: command.message,
    acknowledgedBy: command.status === "acknowledged" ? actorId : null,
  });

  return row ? mapAlertRowToPublicAlert(row) : null;
}

/**
 * Deletes an alert record without touching the underlying alert definition.
 */
export async function deleteAlertById(
  alertId: string,
  ownerId: string,
  dependencies: AlertsServiceDependencies = defaultDependencies,
): Promise<PublicAlert | null> {
  const row = await dependencies.deleteAlert(alertId, ownerId);
  return row ? mapAlertRowToPublicAlert(row) : null;
}
