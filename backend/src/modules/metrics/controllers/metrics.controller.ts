import type { Request, Response } from "express";
import { BadRequestError } from "../../../types/http-error.types.js";

import { getRequiredAuthAccount } from "../../../shared/http/get-required-auth-account.js";
import {
  createMetricDefinitionSchema,
  inventoryCategoryBreakdownQuerySchema,
  inventoryOverviewQuerySchema,
  inventoryMovementSummaryQuerySchema,
  inventoryMovementTrendQuerySchema,
  previewMetricDefinitionSchema,
  updateMetricDefinitionSchema,
} from "../dto/metrics.dto.js";
import {
  createMetricDefinitionForOrganization,
  getBaseMetricCatalog,
  getMetricDefinitionById,
  getInventoryCategoryBreakdownMetrics,
  getInventoryMovementSummaryMetrics,
  getInventoryMovementTrendMetrics,
  getInventoryOverviewMetrics,
  deleteMetricDefinitionById,
  listMetricDefinitionsForOrganization,
  previewMetricDefinitionForOrganization,
  updateMetricDefinitionById,
} from "../services/metrics.service.js";

export async function getBaseMetricCatalogController(
  _req: Request,
  res: Response,
): Promise<void> {
  res.status(200).json(getBaseMetricCatalog());
}

export async function listMetricDefinitionsController(
  req: Request,
  res: Response,
): Promise<void> {
  const authAccount = getRequiredAuthAccount(req, res);
  if (!authAccount) return;

  const result = await listMetricDefinitionsForOrganization(authAccount.orgId);
  res.status(200).json(result);
}

export async function createMetricDefinitionController(
  req: Request,
  res: Response,
): Promise<void> {
  const authAccount = getRequiredAuthAccount(req, res);
  if (!authAccount) return;

  const parsedBody = createMetricDefinitionSchema.safeParse(req.body);

  if (!parsedBody.success) {
    res.status(400).json({
      message: "Invalid metric definition payload",
      errors: parsedBody.error.flatten(),
    });
    return;
  }

  let result;
  try {
    result = await createMetricDefinitionForOrganization(
      authAccount.orgId,
      authAccount.id,
      {
        key: parsedBody.data.key,
        name: parsedBody.data.name,
        scope: parsedBody.data.scope,
        format: parsedBody.data.format,
        definition: parsedBody.data.definition,
        ...(parsedBody.data.description !== undefined
          ? { description: parsedBody.data.description }
          : {}),
      },
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

export async function getMetricDefinitionByIdController(
  req: Request,
  res: Response,
): Promise<void> {
  const authAccount = getRequiredAuthAccount(req, res);
  if (!authAccount) return;

  const metricId = req.params.metricId;

  if (typeof metricId !== "string" || metricId.length === 0) {
    res.status(400).json({ message: "Metric definition id is required" });
    return;
  }

  const result = await getMetricDefinitionById(metricId, authAccount.orgId);

  if (!result) {
    res.status(404).json({ message: "Metric definition not found" });
    return;
  }

  res.status(200).json(result);
}

export async function updateMetricDefinitionController(
  req: Request,
  res: Response,
): Promise<void> {
  const authAccount = getRequiredAuthAccount(req, res);
  if (!authAccount) return;

  const metricId = req.params.metricId;

  if (typeof metricId !== "string" || metricId.length === 0) {
    res.status(400).json({ message: "Metric definition id is required" });
    return;
  }

  const parsedBody = updateMetricDefinitionSchema.safeParse(req.body);

  if (!parsedBody.success) {
    res.status(400).json({
      message: "Invalid metric definition update payload",
      errors: parsedBody.error.flatten(),
    });
    return;
  }

  let result;
  try {
    result = await updateMetricDefinitionById(metricId, authAccount.orgId, {
      ...(parsedBody.data.key !== undefined ? { key: parsedBody.data.key } : {}),
      ...(parsedBody.data.name !== undefined ? { name: parsedBody.data.name } : {}),
      ...(parsedBody.data.description !== undefined
        ? { description: parsedBody.data.description }
        : {}),
      ...(parsedBody.data.scope !== undefined
        ? { scope: parsedBody.data.scope }
        : {}),
      ...(parsedBody.data.format !== undefined
        ? { format: parsedBody.data.format }
        : {}),
      ...(parsedBody.data.definition !== undefined
        ? { definition: parsedBody.data.definition }
        : {}),
      ...(parsedBody.data.isActive !== undefined
        ? { isActive: parsedBody.data.isActive }
        : {}),
    });
  } catch (error) {
    if (error instanceof BadRequestError) {
      res.status(400).json({ message: error.message });
      return;
    }

    throw error;
  }

  if (!result) {
    res.status(404).json({ message: "Metric definition not found" });
    return;
  }

  res.status(200).json(result);
}

export async function deleteMetricDefinitionController(
  req: Request,
  res: Response,
): Promise<void> {
  const authAccount = getRequiredAuthAccount(req, res);
  if (!authAccount) return;

  const metricId = req.params.metricId;

  if (typeof metricId !== "string" || metricId.length === 0) {
    res.status(400).json({ message: "Metric definition id is required" });
    return;
  }

  const result = await deleteMetricDefinitionById(metricId, authAccount.orgId);

  if (!result) {
    res.status(404).json({ message: "Metric definition not found" });
    return;
  }

  res.status(200).json(result);
}

export async function previewMetricDefinitionController(
  req: Request,
  res: Response,
): Promise<void> {
  const authAccount = getRequiredAuthAccount(req, res);
  if (!authAccount) return;

  const parsedBody = previewMetricDefinitionSchema.safeParse(req.body);

  if (!parsedBody.success) {
    res.status(400).json({
      message: "Invalid metric definition preview payload",
      errors: parsedBody.error.flatten(),
    });
    return;
  }

  let result;
  try {
    const filters = parsedBody.data.filters
      ? {
          ...(parsedBody.data.filters.q ? { q: parsedBody.data.filters.q } : {}),
          ...(parsedBody.data.filters.productId
            ? { productId: parsedBody.data.filters.productId }
            : {}),
          ...(parsedBody.data.filters.categoryIds
            ? { categoryIds: parsedBody.data.filters.categoryIds }
            : {}),
          ...(parsedBody.data.filters.stockState
            ? { stockState: parsedBody.data.filters.stockState }
            : {}),
          ...(parsedBody.data.filters.criticalThreshold !== undefined
            ? { criticalThreshold: parsedBody.data.filters.criticalThreshold }
            : {}),
          ...(parsedBody.data.filters.lowThreshold !== undefined
            ? { lowThreshold: parsedBody.data.filters.lowThreshold }
            : {}),
          ...(parsedBody.data.filters.days !== undefined
            ? { days: parsedBody.data.filters.days }
            : {}),
        }
      : undefined;

    result = await previewMetricDefinitionForOrganization(authAccount.orgId, {
      definition: parsedBody.data.definition,
      ...(filters ? { filters } : {}),
    });
  } catch (error) {
    if (error instanceof BadRequestError) {
      res.status(400).json({ message: error.message });
      return;
    }

    throw error;
  }

  res.status(200).json(result);
}

export async function getInventoryOverviewMetricsController(
  req: Request,
  res: Response,
): Promise<void> {
  const authAccount = getRequiredAuthAccount(req, res);
  if (!authAccount) return;

  const parsedQuery = inventoryOverviewQuerySchema.safeParse(req.query);

  if (!parsedQuery.success) {
    res.status(400).json({
      message: "Invalid inventory overview query",
      errors: parsedQuery.error.flatten(),
    });
    return;
  }

  const options = {
    ...(parsedQuery.data.q ? { q: parsedQuery.data.q } : {}),
    ...(parsedQuery.data.productId ? { productId: parsedQuery.data.productId } : {}),
    ...(parsedQuery.data.categoryIds
      ? { categoryIds: parsedQuery.data.categoryIds }
      : {}),
    ...(parsedQuery.data.stockState
      ? { stockState: parsedQuery.data.stockState }
      : {}),
    ...(parsedQuery.data.criticalThreshold !== undefined
      ? { criticalThreshold: parsedQuery.data.criticalThreshold }
      : {}),
    ...(parsedQuery.data.lowThreshold !== undefined
      ? { lowThreshold: parsedQuery.data.lowThreshold }
      : {}),
  };

  const overview = await getInventoryOverviewMetrics(authAccount.orgId, options);
  res.status(200).json({ overview });
}

export async function getInventoryMovementTrendMetricsController(
  req: Request,
  res: Response,
): Promise<void> {
  const authAccount = getRequiredAuthAccount(req, res);
  if (!authAccount) return;

  const parsedQuery = inventoryMovementTrendQuerySchema.safeParse(req.query);

  if (!parsedQuery.success) {
    res.status(400).json({
      message: "Invalid inventory movement trend query",
      errors: parsedQuery.error.flatten(),
    });
    return;
  }

  const options = {
    ...(parsedQuery.data.q ? { q: parsedQuery.data.q } : {}),
    ...(parsedQuery.data.productId ? { productId: parsedQuery.data.productId } : {}),
    ...(parsedQuery.data.categoryIds
      ? { categoryIds: parsedQuery.data.categoryIds }
      : {}),
    ...(parsedQuery.data.stockState
      ? { stockState: parsedQuery.data.stockState }
      : {}),
    ...(parsedQuery.data.criticalThreshold !== undefined
      ? { criticalThreshold: parsedQuery.data.criticalThreshold }
      : {}),
    ...(parsedQuery.data.lowThreshold !== undefined
      ? { lowThreshold: parsedQuery.data.lowThreshold }
      : {}),
  };

  const result = await getInventoryMovementTrendMetrics(
    authAccount.orgId,
    parsedQuery.data.days,
    options,
  );
  res.status(200).json(result);
}

export async function getInventoryCategoryBreakdownMetricsController(
  req: Request,
  res: Response,
): Promise<void> {
  const authAccount = getRequiredAuthAccount(req, res);
  if (!authAccount) return;

  const parsedQuery = inventoryCategoryBreakdownQuerySchema.safeParse(req.query);

  if (!parsedQuery.success) {
    res.status(400).json({
      message: "Invalid inventory category breakdown query",
      errors: parsedQuery.error.flatten(),
    });
    return;
  }

  const options = {
    ...(parsedQuery.data.q ? { q: parsedQuery.data.q } : {}),
    ...(parsedQuery.data.productId ? { productId: parsedQuery.data.productId } : {}),
    ...(parsedQuery.data.categoryIds
      ? { categoryIds: parsedQuery.data.categoryIds }
      : {}),
    ...(parsedQuery.data.stockState
      ? { stockState: parsedQuery.data.stockState }
      : {}),
    ...(parsedQuery.data.criticalThreshold !== undefined
      ? { criticalThreshold: parsedQuery.data.criticalThreshold }
      : {}),
    ...(parsedQuery.data.lowThreshold !== undefined
      ? { lowThreshold: parsedQuery.data.lowThreshold }
      : {}),
  };

  const result = await getInventoryCategoryBreakdownMetrics(
    authAccount.orgId,
    parsedQuery.data.top,
    options,
  );
  res.status(200).json(result);
}

export async function getInventoryMovementSummaryMetricsController(
  req: Request,
  res: Response,
): Promise<void> {
  const authAccount = getRequiredAuthAccount(req, res);
  if (!authAccount) return;

  const parsedQuery = inventoryMovementSummaryQuerySchema.safeParse(req.query);

  if (!parsedQuery.success) {
    res.status(400).json({
      message: "Invalid inventory movement summary query",
      errors: parsedQuery.error.flatten(),
    });
    return;
  }

  const options = {
    ...(parsedQuery.data.q ? { q: parsedQuery.data.q } : {}),
    ...(parsedQuery.data.productId
      ? { productId: parsedQuery.data.productId }
      : {}),
    ...(parsedQuery.data.categoryIds
      ? { categoryIds: parsedQuery.data.categoryIds }
      : {}),
    ...(parsedQuery.data.stockState
      ? { stockState: parsedQuery.data.stockState }
      : {}),
    ...(parsedQuery.data.criticalThreshold !== undefined
      ? { criticalThreshold: parsedQuery.data.criticalThreshold }
      : {}),
    ...(parsedQuery.data.lowThreshold !== undefined
      ? { lowThreshold: parsedQuery.data.lowThreshold }
      : {}),
    ...(parsedQuery.data.days ? { days: parsedQuery.data.days } : {}),
  };

  const result = await getInventoryMovementSummaryMetrics(
    authAccount.orgId,
    options,
  );
  res.status(200).json(result);
}
