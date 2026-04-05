import { Router } from "express";

import { requireAuthenticatedAccount } from "../../middleware/cognito-auth.middleware.js";
import { updateMyUserController } from "./controllers/users.controller.js";

const usersRouter = Router();

usersRouter.patch("/me", requireAuthenticatedAccount, updateMyUserController);

export { usersRouter };
