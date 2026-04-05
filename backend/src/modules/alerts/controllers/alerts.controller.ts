import type { Request, Response } from "express";

import { getRequiredAuthAccount } from "../../../shared/http/get-required-auth-account.js";
import {
  createAlert,
  deleteAlertById,
  getAlertById,
  listAlerts,
  updateAlertById,
} from "../services/alerts.service.js";
import {
  createAlertSchema,
  listAlertsQuerySchema,
  updateAlertSchema,
} from "../dto/alerts.dto.js";

export async function listAlertsController(
  req: Request,
  res: Response,
): Promise<void> {
  const authAccount = getRequiredAuthAccount(req, res);
  if (!authAccount) return;

  const parsedQuery = listAlertsQuerySchema.safeParse(req.query);

  if (!parsedQuery.success) {
    res.status(400).json({
      message: "Invalid alert query",
      errors: parsedQuery.error.flatten(),
    });
    return;
  }

  const result = await listAlerts(authAccount.orgId, parsedQuery.data);
  res.status(200).json(result);
}

export async function getAlertController(
  req: Request,
  res: Response,
): Promise<void> {
  const authAccount = getRequiredAuthAccount(req, res);
  if (!authAccount) return;

  const alertId = req.params.alertId;

  if (typeof alertId !== "string" || alertId.length === 0) {
    res.status(400).json({ message: "Alert ID is required" });
    return;
  }

  const alert = await getAlertById(alertId, authAccount.orgId);

  if (!alert) {
    res.status(404).json({ message: "Alert not found" });
    return;
  }

  res.status(200).json({ alert });
}

export async function createAlertController(
  req: Request,
  res: Response,
): Promise<void> {
  const authAccount = getRequiredAuthAccount(req, res);
  if (!authAccount) return;

  const parsedBody = createAlertSchema.safeParse(req.body);

  if (!parsedBody.success) {
    res.status(400).json({
      message: "Invalid alert payload",
      errors: parsedBody.error.flatten(),
    });
    return;
  }

  const alert = await createAlert(authAccount.orgId, parsedBody.data);
  res.status(201).json({ alert });
}

export async function updateAlertController(
  req: Request,
  res: Response,
): Promise<void> {
  const authAccount = getRequiredAuthAccount(req, res);
  if (!authAccount) return;

  const alertId = req.params.alertId;

  if (typeof alertId !== "string" || alertId.length === 0) {
    res.status(400).json({ message: "Alert ID is required" });
    return;
  }

  const parsedBody = updateAlertSchema.safeParse(req.body);

  if (!parsedBody.success) {
    res.status(400).json({
      message: "Invalid alert payload",
      errors: parsedBody.error.flatten(),
    });
    return;
  }

  const alert = await updateAlertById(
    alertId,
    authAccount.orgId,
    authAccount.id,
    parsedBody.data,
  );

  if (!alert) {
    res.status(404).json({ message: "Alert not found" });
    return;
  }

  res.status(200).json({ alert });
}

export async function deleteAlertController(
  req: Request,
  res: Response,
): Promise<void> {
  const authAccount = getRequiredAuthAccount(req, res);
  if (!authAccount) return;

  const alertId = req.params.alertId;

  if (typeof alertId !== "string" || alertId.length === 0) {
    res.status(400).json({ message: "Alert ID is required" });
    return;
  }

  const alert = await deleteAlertById(alertId, authAccount.orgId);

  if (!alert) {
    res.status(404).json({ message: "Alert not found" });
    return;
  }

  res.status(200).json({ alert });
}
