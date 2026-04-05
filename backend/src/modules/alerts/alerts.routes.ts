import { Router } from "express";

import { requireAuthenticatedAccount } from "../../middleware/cognito-auth.middleware.js";
import { requireAnyOrganizationPermission } from "../organizations/middleware/organization-auth.middleware.js";
import {
  createAlertController,
  deleteAlertController,
  getAlertController,
  listAlertsController,
  updateAlertController,
} from "./controllers/alerts.controller.js";
import {
  createAlertDefinitionController,
  deleteAlertDefinitionController,
  getAlertDefinitionController,
  listAlertDefinitionsController,
  previewAlertDefinitionController,
  updateAlertDefinitionController,
} from "./controllers/alert-definitions.controller.js";

const alertsRouter = Router();

alertsRouter.get(
  "/definitions",
  requireAuthenticatedAccount,
  requireAnyOrganizationPermission(["alert:manage"]),
  listAlertDefinitionsController,
);
alertsRouter.get(
  "/definitions/:alertDefinitionId",
  requireAuthenticatedAccount,
  requireAnyOrganizationPermission(["alert:manage"]),
  getAlertDefinitionController,
);
alertsRouter.post(
  "/definitions",
  requireAuthenticatedAccount,
  requireAnyOrganizationPermission(["alert:manage"]),
  createAlertDefinitionController,
);
alertsRouter.post(
  "/definitions/preview",
  requireAuthenticatedAccount,
  requireAnyOrganizationPermission(["alert:manage"]),
  previewAlertDefinitionController,
);
alertsRouter.patch(
  "/definitions/:alertDefinitionId",
  requireAuthenticatedAccount,
  requireAnyOrganizationPermission(["alert:manage"]),
  updateAlertDefinitionController,
);
alertsRouter.delete(
  "/definitions/:alertDefinitionId",
  requireAuthenticatedAccount,
  requireAnyOrganizationPermission(["alert:manage"]),
  deleteAlertDefinitionController,
);

alertsRouter.get(
  "/",
  requireAuthenticatedAccount,
  requireAnyOrganizationPermission(["alert:manage"]),
  listAlertsController,
);
alertsRouter.get(
  "/:alertId",
  requireAuthenticatedAccount,
  requireAnyOrganizationPermission(["alert:manage"]),
  getAlertController,
);
alertsRouter.post(
  "/",
  requireAuthenticatedAccount,
  requireAnyOrganizationPermission(["alert:manage"]),
  createAlertController,
);
alertsRouter.patch(
  "/:alertId",
  requireAuthenticatedAccount,
  requireAnyOrganizationPermission(["alert:manage"]),
  updateAlertController,
);
alertsRouter.delete(
  "/:alertId",
  requireAuthenticatedAccount,
  requireAnyOrganizationPermission(["alert:manage"]),
  deleteAlertController,
);

export { alertsRouter };
