import { Router } from "express";

import {
  backendLoginController,
  backendRegisterController,
  cognitoLoginController,
  cognitoRefreshController,
  cognitoRegisterController,
  cognitoResolveController,
  cognitoStatusController,
  cognitoVerifyController,
  deleteMyAccountController,
  listAccountsController,
  listPermissionsController,
  loginController,
} from "./controllers/auth.controller.js";
import { requireAuthenticatedAccount } from "../../middleware/cognito-auth.middleware.js";

const authRouter = Router();

authRouter.get("/accounts", requireAuthenticatedAccount, listAccountsController);
authRouter.get(
  "/permissions",
  requireAuthenticatedAccount,
  listPermissionsController,
);
authRouter.delete("/me", requireAuthenticatedAccount, deleteMyAccountController);
authRouter.post("/login", loginController);
authRouter.post("/backend/login", backendLoginController);
authRouter.post("/backend/register", backendRegisterController);
authRouter.get("/cognito", cognitoStatusController);
authRouter.post("/cognito/login", cognitoLoginController);
authRouter.post("/cognito/refresh", cognitoRefreshController);
authRouter.post("/cognito/register", cognitoRegisterController);
authRouter.post("/cognito/resolve", cognitoResolveController);
authRouter.post("/cognito/verify", cognitoVerifyController);

export { authRouter };
