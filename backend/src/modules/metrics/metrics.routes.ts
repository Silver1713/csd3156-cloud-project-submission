import { Router } from "express";

import { requireAuthenticatedAccount } from "../../middleware/cognito-auth.middleware.js";
import { requireAnyOrganizationPermission } from "../organizations/middleware/organization-auth.middleware.js";
import {
  createMetricDefinitionController,
  deleteMetricDefinitionController,
  getBaseMetricCatalogController,
  getMetricDefinitionByIdController,
  getInventoryCategoryBreakdownMetricsController,
  listMetricDefinitionsController,
  previewMetricDefinitionController,
  getInventoryMovementSummaryMetricsController,
  getInventoryMovementTrendMetricsController,
  getInventoryOverviewMetricsController,
  updateMetricDefinitionController,
} from "./controllers/metrics.controller.js";

const metricsRouter = Router();

metricsRouter.get(
  "/catalog",
  requireAuthenticatedAccount,
  requireAnyOrganizationPermission(["inventory:read"]),
  getBaseMetricCatalogController,
);

metricsRouter.get(
  "/definitions",
  requireAuthenticatedAccount,
  requireAnyOrganizationPermission(["inventory:read"]),
  listMetricDefinitionsController,
);

metricsRouter.post(
  "/definitions",
  requireAuthenticatedAccount,
  requireAnyOrganizationPermission(["organization:manage"]),
  createMetricDefinitionController,
);

metricsRouter.get(
  "/definitions/:metricId",
  requireAuthenticatedAccount,
  requireAnyOrganizationPermission(["inventory:read"]),
  getMetricDefinitionByIdController,
);

metricsRouter.patch(
  "/definitions/:metricId",
  requireAuthenticatedAccount,
  requireAnyOrganizationPermission(["organization:manage"]),
  updateMetricDefinitionController,
);

metricsRouter.delete(
  "/definitions/:metricId",
  requireAuthenticatedAccount,
  requireAnyOrganizationPermission(["organization:manage"]),
  deleteMetricDefinitionController,
);

metricsRouter.post(
  "/definitions/preview",
  requireAuthenticatedAccount,
  requireAnyOrganizationPermission(["inventory:read"]),
  previewMetricDefinitionController,
);

metricsRouter.get(
  "/inventory/overview",
  requireAuthenticatedAccount,
  requireAnyOrganizationPermission(["inventory:read"]),
  getInventoryOverviewMetricsController,
);

metricsRouter.get(
  "/inventory/movement-trend",
  requireAuthenticatedAccount,
  requireAnyOrganizationPermission(["stockmovement:read"]),
  getInventoryMovementTrendMetricsController,
);

metricsRouter.get(
  "/inventory/movement-summary",
  requireAuthenticatedAccount,
  requireAnyOrganizationPermission(["stockmovement:read"]),
  getInventoryMovementSummaryMetricsController,
);

metricsRouter.get(
  "/inventory/category-breakdown",
  requireAuthenticatedAccount,
  requireAnyOrganizationPermission(["inventory:read"]),
  getInventoryCategoryBreakdownMetricsController,
);

export { metricsRouter };
