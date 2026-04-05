import { Router } from "express";
import { requireAuthenticatedAccount } from "../../middleware/cognito-auth.middleware.js";
import { requireAnyOrganizationPermission } from "../organizations/middleware/organization-auth.middleware.js";

import {
  createProductController,
  deleteProductController,
  getProductController,
  listProductsController,
  updateProductController,
} from "./controllers/product.controller.js";

const productRouter = Router();

productRouter.get(
  "/",
  requireAuthenticatedAccount,
  requireAnyOrganizationPermission(["product:read"]),
  listProductsController,
);
productRouter.get(
  "/:productId",
  requireAuthenticatedAccount,
  requireAnyOrganizationPermission(["product:read"]),
  getProductController,
);
productRouter.post(
  "/",
  requireAuthenticatedAccount,
  requireAnyOrganizationPermission(["product:create"]),
  createProductController,
);
productRouter.put(
  "/:productId",
  requireAuthenticatedAccount,
  requireAnyOrganizationPermission(["product:update"]),
  updateProductController,
);
productRouter.delete(
  "/:productId",
  requireAuthenticatedAccount,
  requireAnyOrganizationPermission(["product:delete"]),
  deleteProductController,
);

export { productRouter };
