import type { Request, Response } from "express";

import { registerRequestSchema } from "../dto/register.dto.js";
import { loginRequestSchema } from "../dto/login.dto.js";
import { refreshCognitoRequestSchema } from "../dto/refresh.dto.js";
import { resolveCognitoSessionRequestSchema } from "../dto/resolve.dto.js";
import { verifyCognitoRequestSchema } from "../dto/verify.dto.js";
import { getRequiredAuthAccount } from "../../../shared/http/get-required-auth-account.js";
import { getPermissionCatalog } from "../services/authorization.service.js";
import {
  deleteMyAccount,
  getCognitoStatus,
  listAccounts,
  loginWithBackend,
  loginWithCognito,
  refreshWithCognito,
  resolveCognitoSession,
  registerWithBackend,
  registerWithCognito,
  verifyWithCognito,
} from "../services/auth.service.js";
import {
  AccountDeletionBlockedError,
  AccountNotFoundError,
} from "../types/auth.errors.types.js";

export async function backendLoginController(
  req: Request,
  res: Response,
): Promise<void> {
  const parsedBody = loginRequestSchema.safeParse(req.body);

  if (!parsedBody.success) {
    res.status(400).json({
      message: "Invalid login request",
      errors: parsedBody.error.flatten(),
    });
    return;
  }

  try {
    const result = await loginWithBackend(parsedBody.data);
    res.status(200).json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Authentication failed";

    res.status(401).json({ message });
  }
}

export async function backendRegisterController(
  req: Request,
  res: Response,
): Promise<void> {
  const parsedBody = registerRequestSchema.safeParse(req.body);

  if (!parsedBody.success) {
    res.status(400).json({
      message: "Invalid register request",
      errors: parsedBody.error.flatten(),
    });
    return;
  }

  try {
    const result = await registerWithBackend(parsedBody.data);
    res.status(201).json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Registration failed";

    res.status(400).json({ message });
  }
}

export async function cognitoLoginController(
  req: Request,
  res: Response,
): Promise<void> {
  const parsedBody = loginRequestSchema.safeParse(req.body);

  if (!parsedBody.success) {
    res.status(400).json({
      message: "Invalid Cognito login request",
      errors: parsedBody.error.flatten(),
    });
    return;
  }

  try {
    const result = await loginWithCognito(parsedBody.data);
    res.status(200).json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Cognito login flow failed";

    res.status(500).json({ message });
  }
}

export async function cognitoRegisterController(
  req: Request,
  res: Response,
): Promise<void> {
  const parsedBody = registerRequestSchema.safeParse(req.body);

  if (!parsedBody.success) {
    res.status(400).json({
      message: "Invalid Cognito register request",
      errors: parsedBody.error.flatten(),
    });
    return;
  }

  try {
    const result = await registerWithCognito(parsedBody.data);
    res.status(201).json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Cognito registration flow failed";

    res.status(500).json({ message });
  }
}

export async function cognitoRefreshController(
  req: Request,
  res: Response,
): Promise<void> {
  const parsedBody = refreshCognitoRequestSchema.safeParse(req.body);

  if (!parsedBody.success) {
    res.status(400).json({
      message: "Invalid Cognito refresh request",
      errors: parsedBody.error.flatten(),
    });
    return;
  }

  try {
    const result = await refreshWithCognito(parsedBody.data);
    res.status(200).json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Cognito refresh failed";

    res.status(401).json({ message });
  }
}

export async function cognitoVerifyController(
  req: Request,
  res: Response,
): Promise<void> {
  const parsedBody = verifyCognitoRequestSchema.safeParse(req.body);

  if (!parsedBody.success) {
    res.status(400).json({
      message: "Invalid Cognito verify request",
      errors: parsedBody.error.flatten(),
    });
    return;
  }

  try {
    const result = await verifyWithCognito(parsedBody.data);
    res.status(200).json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Cognito verification failed";

    res.status(401).json({ message });
  }
}

export async function cognitoResolveController(
  req: Request,
  res: Response,
): Promise<void> {
  const parsedBody = resolveCognitoSessionRequestSchema.safeParse(req.body);

  if (!parsedBody.success) {
    res.status(400).json({
      message: "Invalid Cognito resolve request",
      errors: parsedBody.error.flatten(),
    });
    return;
  }

  try {
    const result = await resolveCognitoSession({
      accessToken: parsedBody.data.accessToken,
      idToken: parsedBody.data.idToken,
      ...(parsedBody.data.joinKey ? { joinKey: parsedBody.data.joinKey } : {}),
    });
    res.status(200).json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Cognito resolve flow failed";

    res.status(400).json({ message });
  }
}

export async function cognitoStatusController(
  _req: Request,
  res: Response,
): Promise<void> {
  try {
    const result = await getCognitoStatus();
    res.status(200).json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load Cognito status";

    res.status(500).json({ message });
  }
}

export async function loginController(
  req: Request,
  res: Response,
): Promise<void> {
  await backendLoginController(req, res);
}

export async function listAccountsController(
  _req: Request,
  res: Response,
): Promise<void> {
  try {
    const accounts = await listAccounts();
    res.status(200).json({ accounts });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load accounts";

    res.status(500).json({ message });
  }
}

export async function listPermissionsController(
  _req: Request,
  res: Response,
): Promise<void> {
  try {
    const result = getPermissionCatalog();
    res.status(200).json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load permissions";

    res.status(500).json({ message });
  }
}

export async function deleteMyAccountController(
  req: Request,
  res: Response,
): Promise<void> {
  const authAccount = getRequiredAuthAccount(req, res);

  if (!authAccount) {
    return;
  }

  try {
    const result = await deleteMyAccount(authAccount.id);
    res.status(200).json(result);
  } catch (error) {
    if (error instanceof AccountNotFoundError) {
      res.status(404).json({ message: error.message });
      return;
    }

    if (error instanceof AccountDeletionBlockedError) {
      res.status(400).json({ message: error.message });
      return;
    }

    const message =
      error instanceof Error ? error.message : "Failed to delete account";

    res.status(500).json({ message });
  }
}
