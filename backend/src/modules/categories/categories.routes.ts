import { Router } from "express";

import { requireAuthenticatedAccount } from "../../middleware/cognito-auth.middleware.js";
import { requireAnyOrganizationPermission } from "../organizations/middleware/organization-auth.middleware.js";
import {
  createCategoryController,
  deleteCategoryController,
  getCategoryController,
  listCategoriesController,
  updateCategoryController,
} from "./controllers/categories.controller.js";

const categoriesRouter = Router();

categoriesRouter.get(
  "/",
  requireAuthenticatedAccount,
  requireAnyOrganizationPermission(["category:read"]),
  listCategoriesController,
);
categoriesRouter.get(
  "/:categoryId",
  requireAuthenticatedAccount,
  requireAnyOrganizationPermission(["category:read"]),
  getCategoryController,
);
categoriesRouter.post(
  "/",
  requireAuthenticatedAccount,
  requireAnyOrganizationPermission(["category:create"]),
  createCategoryController,
);
categoriesRouter.put(
  "/:categoryId",
  requireAuthenticatedAccount,
  requireAnyOrganizationPermission(["category:update"]),
  updateCategoryController,
);
categoriesRouter.delete(
  "/:categoryId",
  requireAuthenticatedAccount,
  requireAnyOrganizationPermission(["category:delete"]),
  deleteCategoryController,
);

export { categoriesRouter };
