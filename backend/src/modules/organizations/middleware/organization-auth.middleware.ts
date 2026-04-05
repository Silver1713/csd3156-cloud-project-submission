import type { NextFunction, Request, Response } from "express";

import { getBasePermissions } from "../../auth/services/authorization.service.js";
import { getOrganizationAccessContext } from "../services/organizations.service.js";
import type { Permission } from "../../auth/types/auth.permission.types.js";

export function requireAnyBasePermission(requiredPermissions: Permission[]) {
  return (_req: Request, res: Response, next: NextFunction): void => {
    const permissions = getBasePermissions();
    const allowed = requiredPermissions.some((permission) =>
      permissions.includes(permission),
    );

    if (!allowed) {
      res.status(403).json({
        message: `Missing required base permission. Expected any of: ${requiredPermissions.join(", ")}`,
      });
      return;
    }

    next();
  };
}

export function requireBasePermission(permission: Permission) {
  return requireAnyBasePermission([permission]);
}

export function requireAnyOrganizationPermission(
  requiredPermissions: Permission[],
) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const authAccount = req.authAccount;

    if (!authAccount) {
      res.status(401).json({ message: "Missing authenticated user context" });
      return;
    }

    try {
      const accessContext = await getOrganizationAccessContext(authAccount.id);
      const effectivePermissions = accessContext.role?.permissions ?? [];
      const allowed = requiredPermissions.some((entry) =>
        effectivePermissions.includes(entry),
      );

      if (!allowed) {
        res.status(403).json({
          message: `Missing required organization permission. Expected any of: ${requiredPermissions.join(", ")}`,
        });
        return;
      }

      req.organizationAccessContext = accessContext;
      next();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to resolve organization access context";

      res.status(403).json({ message });
    }
  };
}

export function requireOrganizationPermission(
  permission: Permission,
  alternatives: Permission[] = [],
) {
  return requireAnyOrganizationPermission([permission, ...alternatives]);
}
