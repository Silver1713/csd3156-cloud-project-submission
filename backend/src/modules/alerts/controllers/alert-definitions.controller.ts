import type { Request, Response } from "express";
import { BadRequestError } from "../../../types/http-error.types.js";

import { getRequiredAuthAccount } from "../../../shared/http/get-required-auth-account.js";
import {
  createAlertDefinitionSchema,
  previewAlertDefinitionSchema,
  updateAlertDefinitionSchema,
} from "../dto/alert-definitions.dto.js";
import {
  createAlertDefinitionForOrganization,
  deleteAlertDefinitionById,
  getAlertDefinitionById,
  listAlertDefinitionsForOrganization,
  previewAlertDefinitionForOrganization,
  updateAlertDefinitionById,
} from "../services/alert-definitions.service.js";

export async function listAlertDefinitionsController(
  req: Request,
  res: Response,
): Promise<void> {
  const authAccount = getRequiredAuthAccount(req, res);
  if (!authAccount) return;

  const result = await listAlertDefinitionsForOrganization(authAccount.orgId);
  res.status(200).json(result);
}

export async function getAlertDefinitionController(
  req: Request,
  res: Response,
): Promise<void> {
  const authAccount = getRequiredAuthAccount(req, res);
  if (!authAccount) return;

  const alertDefinitionId = req.params.alertDefinitionId;

  if (typeof alertDefinitionId !== "string" || alertDefinitionId.length === 0) {
    res.status(400).json({ message: "Alert definition ID is required" });
    return;
  }

  const result = await getAlertDefinitionById(alertDefinitionId, authAccount.orgId);

  if (!result) {
    res.status(404).json({ message: "Alert definition not found" });
    return;
  }

  res.status(200).json(result);
}

export async function createAlertDefinitionController(
  req: Request,
  res: Response,
): Promise<void> {
  const authAccount = getRequiredAuthAccount(req, res);
  if (!authAccount) return;

  const parsedBody = createAlertDefinitionSchema.safeParse(req.body);

  if (!parsedBody.success) {
    res.status(400).json({
      message: "Invalid alert definition payload",
      errors: parsedBody.error.flatten(),
    });
    return;
  }

  let result;
  try {
    result = await createAlertDefinitionForOrganization(
      authAccount.orgId,
      authAccount.id,
      parsedBody.data,
    );
  } catch (error) {
    if (error instanceof BadRequestError) {
      res.status(400).json({ message: error.message });
      return;
    }

    throw error;
  }
  res.status(201).json(result);
}

export async function previewAlertDefinitionController(
  req: Request,
  res: Response,
): Promise<void> {
  const authAccount = getRequiredAuthAccount(req, res);
  if (!authAccount) return;

  const parsedBody = previewAlertDefinitionSchema.safeParse(req.body);

  if (!parsedBody.success) {
    res.status(400).json({
      message: "Invalid alert definition preview payload",
      errors: parsedBody.error.flatten(),
    });
    return;
  }

  let result;
  try {
    result = await previewAlertDefinitionForOrganization(
      authAccount.orgId,
      parsedBody.data,
    );
  } catch (error) {
    if (error instanceof BadRequestError) {
      res.status(400).json({ message: error.message });
      return;
    }

    throw error;
  }

  res.status(200).json(result);
}

export async function updateAlertDefinitionController(
  req: Request,
  res: Response,
): Promise<void> {
  const authAccount = getRequiredAuthAccount(req, res);
  if (!authAccount) return;

  const alertDefinitionId = req.params.alertDefinitionId;

  if (typeof alertDefinitionId !== "string" || alertDefinitionId.length === 0) {
    res.status(400).json({ message: "Alert definition ID is required" });
    return;
  }

  const parsedBody = updateAlertDefinitionSchema.safeParse(req.body);

  if (!parsedBody.success) {
    res.status(400).json({
      message: "Invalid alert definition payload",
      errors: parsedBody.error.flatten(),
    });
    return;
  }

  let result;
  try {
    result = await updateAlertDefinitionById(
      alertDefinitionId,
      authAccount.orgId,
      parsedBody.data,
    );
  } catch (error) {
    if (error instanceof BadRequestError) {
      res.status(400).json({ message: error.message });
      return;
    }

    throw error;
  }

  if (!result) {
    res.status(404).json({ message: "Alert definition not found" });
    return;
  }

  res.status(200).json(result);
}

export async function deleteAlertDefinitionController(
  req: Request,
  res: Response,
): Promise<void> {
  const authAccount = getRequiredAuthAccount(req, res);
  if (!authAccount) return;

  const alertDefinitionId = req.params.alertDefinitionId;

  if (typeof alertDefinitionId !== "string" || alertDefinitionId.length === 0) {
    res.status(400).json({ message: "Alert definition ID is required" });
    return;
  }

  const result = await deleteAlertDefinitionById(
    alertDefinitionId,
    authAccount.orgId,
  );

  if (!result) {
    res.status(404).json({ message: "Alert definition not found" });
    return;
  }

  res.status(200).json(result);
}
