import type { NextFunction, Request, Response } from "express";

import { findAccountByCognitoSub } from "../modules/auth/repositories/auth.repository.js";
import { verifyCognitoAccessToken } from "../modules/auth/cognito.helper.js";
import {
  verifyBackendAccessToken,
} from "../modules/auth/services/auth.service.js";

const BACKEND_API_BYPASS_ACCOUNT = {
  id: "backend-api",
  orgId: "00000000-0000-0000-0000-000000000000",
  profileUrl: null,
  name: null,
  username: "backend-api",
  email: "backend-api@local",
  authProvider: "backend" as const,
  cognitoSub: null,
  roleId: null,
};

function extractBearerToken(authorizationHeader: string | undefined): string | null {
  if (!authorizationHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authorizationHeader.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

function extractBackendApiKey(req: Request): string | null {
  const rawHeader = req.headers["x-backend-api-key"];

  if (Array.isArray(rawHeader)) {
    const firstValue = rawHeader[0]?.trim();
    return firstValue || null;
  }

  if (typeof rawHeader === "string") {
    const trimmed = rawHeader.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  return null;
}

function isBackendApiAuthorized(req: Request): boolean {
  const configuredKey = process.env.AUTH_BACKEND_API?.trim();

  if (!configuredKey) {
    return false;
  }

  const providedKey = extractBackendApiKey(req);
  return providedKey === configuredKey;
}

function isBackendApiBypassEnabled(): boolean {
  return process.env.AUTH_ENABLE_BACKEND_API_BYPASS?.trim() === "true";
}

export function requireBackendApiKey(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!isBackendApiAuthorized(req)) {
    res.status(401).json({ message: "Missing or invalid backend API key" });
    return;
  }

  next();
}

export async function requireAuthenticatedAccount(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (isBackendApiBypassEnabled() && isBackendApiAuthorized(req)) {
    req.authAccount = BACKEND_API_BYPASS_ACCOUNT;
    next();
    return;
  }

  const token = extractBearerToken(req.headers.authorization);

  if (!token) {
    res.status(401).json({ message: "Missing bearer token" });
    return;
  }

  try {
    const claims = await verifyCognitoAccessToken(token);
    const account = await findAccountByCognitoSub(claims.sub);

    if (!account) {
      res.status(401).json({
        message: "Cognito identity is not linked to a local account",
      });
      return;
    }

    req.cognitoAuth = {
      accessToken: token,
      claims,
      account,
    };
    req.authAccount = {
      id: account.id,
      orgId: account.org_id,
      profileUrl: account.profile_url,
      name: account.name,
      email: account.email,
      username: account.username,
      authProvider: account.auth_provider,
      cognitoSub: account.cognito_sub,
      roleId: account.role_id,
    };

    next();
  } catch (error) {
    try {
      const account = await verifyBackendAccessToken(token);

      if (account) {
        req.authAccount = account;
        next();
        return;
      }
    } catch {
      // Fall through to the unauthorized response below.
    }

    const message =
      error instanceof Error
        ? error.message
        : "Invalid Cognito or backend bearer token";

    res.status(401).json({ message });
  }
}
