import type { Request, Response } from "express";

import { getRequiredAuthAccount } from "../../../shared/http/get-required-auth-account.js";
import { updateCurrentUserRequestSchema } from "../dto/update-user.dto.js";
import { updateMyUser } from "../services/users.service.js";

export async function updateMyUserController(
  req: Request,
  res: Response,
): Promise<void> {
  const authAccount = getRequiredAuthAccount(req, res);
  if (!authAccount) return;

  const parsedBody = updateCurrentUserRequestSchema.safeParse(req.body);

  if (!parsedBody.success) {
    res.status(400).json({
      message: "Invalid user update request",
      errors: parsedBody.error.flatten(),
    });
    return;
  }

  try {
    const result = await updateMyUser(authAccount.id, parsedBody.data);
    res.status(200).json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update user";

    res.status(400).json({ message });
  }
}
