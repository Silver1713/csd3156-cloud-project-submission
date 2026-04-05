import { Router } from "express";

import { requireAuthenticatedAccount } from "../../middleware/cognito-auth.middleware.js";
import { requireAnyOrganizationPermission } from "../organizations/middleware/organization-auth.middleware.js";
import {
  createInventoryAdjustmentController,
  createInventoryController,
  createStockMovementController,
  deleteInventoryController,
  getInventoryByProductController,
  getInventorySummaryController,
  getStockMovementsController,
  getStockMovementTypesController,
  updateInventoryController,
} from "./controllers/inventory.controller.js";

const inventoryRouter = Router();

inventoryRouter.get(
  "/movements/types",
  requireAuthenticatedAccount,
  getStockMovementTypesController,
);

inventoryRouter.get(
  "/",
  requireAuthenticatedAccount,
  requireAnyOrganizationPermission(["inventory:read"]),
  getInventorySummaryController,
);
inventoryRouter.get(
  "/summary",
  requireAuthenticatedAccount,
  requireAnyOrganizationPermission(["inventory:read"]),
  getInventorySummaryController,
);
inventoryRouter.get(
  "/movements",
  requireAuthenticatedAccount,
  requireAnyOrganizationPermission(["stockmovement:read"]),
  getStockMovementsController,
);
inventoryRouter.post(
  "/adjustments",
  requireAuthenticatedAccount,
  requireAnyOrganizationPermission(["inventory:update"]),
  createInventoryAdjustmentController,
);
inventoryRouter.post(
  "/movements",
  requireAuthenticatedAccount,
  requireAnyOrganizationPermission(["stockmovement:create"]),
  createStockMovementController,
);
inventoryRouter.get(
  "/:productId",
  requireAuthenticatedAccount,
  requireAnyOrganizationPermission(["inventory:read"]),
  getInventoryByProductController,
);
inventoryRouter.post(
  "/",
  requireAuthenticatedAccount,
  requireAnyOrganizationPermission(["inventory:update"]),
  createInventoryController,
);
inventoryRouter.patch(
  "/:productId",
  requireAuthenticatedAccount,
  requireAnyOrganizationPermission(["inventory:update"]),
  updateInventoryController,
);
inventoryRouter.delete(
  "/:productId",
  requireAuthenticatedAccount,
  requireAnyOrganizationPermission(["inventory:update"]),
  deleteInventoryController,
);

export { inventoryRouter };
