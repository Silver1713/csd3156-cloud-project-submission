import { Router } from "express";

import { requireAuthenticatedAccount } from "../../middleware/cognito-auth.middleware.js";
import { requireAnyOrganizationPermission } from "../organizations/middleware/organization-auth.middleware.js";
import {
  createProductImagePresignController,
  createProfileImagePresignController,
} from "./controllers/uploads.controller.js";

const uploadsRouter = Router();

uploadsRouter.post(
  "/products/presign",
  requireAuthenticatedAccount,
  requireAnyOrganizationPermission(["product:create", "product:update"]),
  createProductImagePresignController,
);

uploadsRouter.post(
  "/profile/presign",
  requireAuthenticatedAccount,
  createProfileImagePresignController,
);

export { uploadsRouter };
