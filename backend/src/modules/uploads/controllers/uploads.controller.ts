import type { Request, Response } from "express";

import { getRequiredAuthAccount } from "../../../shared/http/get-required-auth-account.js";
import {
  createProductImagePresignSchema,
  createProfileImagePresignSchema,
} from "../dto/uploads.dto.js";
import {
  createProductImageUploadPresign,
  createProfileImageUploadPresign,
} from "../services/uploads.service.js";

export async function createProductImagePresignController(
  req: Request,
  res: Response,
): Promise<void> {
  const authAccount = getRequiredAuthAccount(req, res);
  if (!authAccount) return;

  const parsedBody = createProductImagePresignSchema.safeParse(req.body);

  if (!parsedBody.success) {
    res.status(400).json({
      message: "Invalid product image upload payload",
      errors: parsedBody.error.flatten(),
    });
    return;
  }

  try {
    const upload = await createProductImageUploadPresign(
      authAccount.orgId,
      parsedBody.data,
    );
    res.status(200).json(upload);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to create product image upload URL";

    const status =
      message === "Unsupported image content type" ? 400 : 500;

    res.status(status).json({ message });
  }
}

export async function createProfileImagePresignController(
  req: Request,
  res: Response,
): Promise<void> {
  const authAccount = getRequiredAuthAccount(req, res);
  if (!authAccount) return;

  const parsedBody = createProfileImagePresignSchema.safeParse(req.body);

  if (!parsedBody.success) {
    res.status(400).json({
      message: "Invalid profile image upload payload",
      errors: parsedBody.error.flatten(),
    });
    return;
  }

  try {
    const upload = await createProfileImageUploadPresign(
      authAccount.id,
      parsedBody.data,
    );
    res.status(200).json(upload);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to create profile image upload URL";

    const status =
      message === "Unsupported image content type" ? 400 : 500;

    res.status(status).json({ message });
  }
}
