import type { Request, Response } from "express";

import type { AuthenticatedAccountContext } from "../../modules/auth/types/auth.request.types.js";

export function getRequiredAuthAccount(
  req: Request,
  res: Response,
): AuthenticatedAccountContext | null {
  const authAccount = req.authAccount;

  if (!authAccount) {
    res.status(401).json({ message: "Missing authenticated user context" });
    return null;
  }

  return authAccount;
}
