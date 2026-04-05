import type { Request, Response } from "express";

import { getRequiredAuthAccount } from "../../../shared/http/get-required-auth-account.js";
import { createOrganizationRequestSchema } from "../dto/create-organization.dto.js";
import { createOrganizationRoleRequestSchema } from "../dto/create-organization-role.dto.js";
import { deleteOrganizationParamsSchema } from "../dto/delete-organization.dto.js";
import { joinOrganizationRequestSchema } from "../dto/join-organization.dto.js";
import { removeOrganizationMemberParamsSchema } from "../dto/remove-organization-member.dto.js";
import {
  updateOrganizationMemberParamsSchema,
  updateOrganizationMemberRequestSchema,
} from "../dto/update-organization-member.dto.js";
import {
  updateOrganizationParamsSchema,
  updateOrganizationRequestSchema,
} from "../dto/update-organization.dto.js";
import {
  createOrganizationRoleForAccount,
  createOrganizationForAccount,
  deleteOrganizationForAccount,
  getCurrentOrganizationForAccount,
  getOrganizationMemberCountForAccount,
  getOrganizationPermissionCatalogForAccount,
  joinOrganizationForAccount,
  listOrganizationRolesForAccount,
  listOrganizationMembersForAccount,
  regenerateOrganizationJoinKeyForAccount,
  removeOrganizationMemberForAccount,
  updateOrganizationMemberForAccount,
  updateOrganizationForAccount,
} from "../services/organizations.service.js";

export async function createOrganizationController(
  req: Request,
  res: Response,
): Promise<void> {
  const authAccount = getRequiredAuthAccount(req, res);
  if (!authAccount) return;

  const parsedBody = createOrganizationRequestSchema.safeParse(req.body);

  if (!parsedBody.success) {
    res.status(400).json({
      message: "Invalid organization create request",
      errors: parsedBody.error.flatten(),
    });
    return;
  }

  try {
    const result = await createOrganizationForAccount(authAccount, parsedBody.data);
    res.status(201).json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create organization";

    res.status(400).json({ message });
  }
}

export async function updateOrganizationController(
  req: Request,
  res: Response,
): Promise<void> {
  const authAccount = getRequiredAuthAccount(req, res);
  if (!authAccount) return;

  const parsedParams = updateOrganizationParamsSchema.safeParse(req.params);
  const parsedBody = updateOrganizationRequestSchema.safeParse(req.body);

  if (!parsedParams.success || !parsedBody.success) {
    res.status(400).json({
      message: "Invalid organization update request",
      errors: {
        params: parsedParams.success ? undefined : parsedParams.error.flatten(),
        body: parsedBody.success ? undefined : parsedBody.error.flatten(),
      },
    });
    return;
  }

  try {
    const result = await updateOrganizationForAccount(
      authAccount,
      {
        organizationId: parsedParams.data.organizationId,
        ...(parsedBody.data.name !== undefined
          ? { name: parsedBody.data.name }
          : {}),
        ...(parsedBody.data.criticalStockThreshold !== undefined
          ? {
              criticalStockThreshold: parsedBody.data.criticalStockThreshold,
            }
          : {}),
        ...(parsedBody.data.lowStockThreshold !== undefined
          ? {
              lowStockThreshold: parsedBody.data.lowStockThreshold,
            }
          : {}),
      },
      req.organizationAccessContext,
    );
    res.status(200).json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update organization";

    res.status(400).json({ message });
  }
}

export async function deleteOrganizationController(
  req: Request,
  res: Response,
): Promise<void> {
  const authAccount = getRequiredAuthAccount(req, res);
  if (!authAccount) return;

  const parsedParams = deleteOrganizationParamsSchema.safeParse(req.params);

  if (!parsedParams.success) {
    res.status(400).json({
      message: "Invalid organization delete request",
      errors: parsedParams.error.flatten(),
    });
    return;
  }

  try {
    const result = await deleteOrganizationForAccount(
      authAccount,
      {
        organizationId: parsedParams.data.organizationId,
      },
      req.organizationAccessContext,
    );
    res.status(200).json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete organization";

    res.status(400).json({ message });
  }
}

export async function listOrganizationMembersController(
  req: Request,
  res: Response,
): Promise<void> {
  const authAccount = getRequiredAuthAccount(req, res);
  if (!authAccount) return;

  try {
    const members = await listOrganizationMembersForAccount(authAccount.id);
    res.status(200).json({ members });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load organization members";

    res.status(400).json({ message });
  }
}

export async function listOrganizationRolesController(
  req: Request,
  res: Response,
): Promise<void> {
  const authAccount = getRequiredAuthAccount(req, res);
  if (!authAccount) return;

  try {
    const result = await listOrganizationRolesForAccount(authAccount.id);
    res.status(200).json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load organization roles";

    res.status(400).json({ message });
  }
}

export async function getOrganizationPermissionCatalogController(
  req: Request,
  res: Response,
): Promise<void> {
  const authAccount = getRequiredAuthAccount(req, res);
  if (!authAccount) return;

  try {
    const result = await getOrganizationPermissionCatalogForAccount(authAccount.id);
    res.status(200).json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load permission catalog";

    res.status(400).json({ message });
  }
}

export async function createOrganizationRoleController(
  req: Request,
  res: Response,
): Promise<void> {
  const authAccount = getRequiredAuthAccount(req, res);
  if (!authAccount) return;

  const parsedBody = createOrganizationRoleRequestSchema.safeParse(req.body);

  if (!parsedBody.success) {
    res.status(400).json({
      message: "Invalid organization role create request",
      errors: parsedBody.error.flatten(),
    });
    return;
  }

  try {
    const result = await createOrganizationRoleForAccount(
      authAccount,
      parsedBody.data,
      req.organizationAccessContext,
    );
    res.status(201).json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create organization role";

    res.status(400).json({ message });
  }
}

export async function getCurrentOrganizationController(
  req: Request,
  res: Response,
): Promise<void> {
  const authAccount = getRequiredAuthAccount(req, res);
  if (!authAccount) return;

  try {
    const result = await getCurrentOrganizationForAccount(authAccount.id);
    res.status(200).json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load current organization";

    res.status(400).json({ message });
  }
}

export async function regenerateOrganizationJoinKeyController(
  req: Request,
  res: Response,
): Promise<void> {
  const authAccount = getRequiredAuthAccount(req, res);
  if (!authAccount) return;

  try {
    const result = await regenerateOrganizationJoinKeyForAccount(
      authAccount,
      req.organizationAccessContext,
    );
    res.status(200).json(result);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to regenerate organization join key";

    res.status(400).json({ message });
  }
}

export async function getOrganizationMemberCountController(
  req: Request,
  res: Response,
): Promise<void> {
  const authAccount = getRequiredAuthAccount(req, res);
  if (!authAccount) return;

  try {
    const result = await getOrganizationMemberCountForAccount(authAccount.id);
    res.status(200).json(result);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to load organization member count";

    res.status(400).json({ message });
  }
}

export async function joinOrganizationController(
  req: Request,
  res: Response,
): Promise<void> {
  const authAccount = getRequiredAuthAccount(req, res);
  if (!authAccount) return;

  const parsedBody = joinOrganizationRequestSchema.safeParse(req.body);

  if (!parsedBody.success) {
    res.status(400).json({
      message: "Invalid organization join request",
      errors: parsedBody.error.flatten(),
    });
    return;
  }

  try {
    const result = await joinOrganizationForAccount(
      authAccount,
      parsedBody.data,
      req.organizationAccessContext,
    );
    res.status(200).json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to join organization";

    res.status(400).json({ message });
  }
}

export async function updateOrganizationMemberController(
  req: Request,
  res: Response,
): Promise<void> {
  const authAccount = getRequiredAuthAccount(req, res);
  if (!authAccount) return;

  const parsedParams = updateOrganizationMemberParamsSchema.safeParse(req.params);
  const parsedBody = updateOrganizationMemberRequestSchema.safeParse(req.body);

  if (!parsedParams.success || !parsedBody.success) {
    res.status(400).json({
      message: "Invalid organization member update request",
      errors: {
        params: parsedParams.success ? undefined : parsedParams.error.flatten(),
        body: parsedBody.success ? undefined : parsedBody.error.flatten(),
      },
    });
    return;
  }

  try {
    const result = await updateOrganizationMemberForAccount(
      authAccount,
      {
        accountId: parsedParams.data.accountId,
        roleId: parsedBody.data.roleId,
      },
      req.organizationAccessContext,
    );
    res.status(200).json(result);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to update organization member";

    res.status(400).json({ message });
  }
}

export async function removeOrganizationMemberController(
  req: Request,
  res: Response,
): Promise<void> {
  const authAccount = getRequiredAuthAccount(req, res);
  if (!authAccount) return;

  const parsedParams = removeOrganizationMemberParamsSchema.safeParse(req.params);

  if (!parsedParams.success) {
    res.status(400).json({
      message: "Invalid organization member remove request",
      errors: parsedParams.error.flatten(),
    });
    return;
  }

  try {
    const result = await removeOrganizationMemberForAccount(
      authAccount,
      {
        accountId: parsedParams.data.accountId,
      },
      req.organizationAccessContext,
    );
    res.status(200).json(result);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to remove organization member";

    res.status(400).json({ message });
  }
}
