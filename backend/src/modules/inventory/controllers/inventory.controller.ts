import type { Request, Response } from "express";

import { getRequiredAuthAccount } from "../../../shared/http/get-required-auth-account.js";
import { createInventorySchema } from "../dto/create-inventory.dto.js";
import { listStockMovementsQuerySchema } from "../dto/list-stock-movements.dto.js";
import { createInventoryAdjustmentSchema } from "../dto/create-adjustment.dto.js";
import { createStockMovementSchema } from "../dto/create-movement.dto.js";
import { deleteInventoryParamsSchema } from "../dto/delete-inventory.dto.js";
import {
  updateInventoryParamsSchema,
  updateInventorySchema,
} from "../dto/update-inventory.dto.js";
import {
  createInventoryBalance,
  recordInventoryAdjustment,
  deleteInventoryBalance,
  getInventorySummaryByProductId,
  listInventorySummaries,
  listStockMovements,
  recordStockMovement,
  updateInventoryBalance,
} from "../services/inventory.service.js";
import { inventoryMovementTypes } from "../types/inventory.movement.types.js";
import {
  InsufficientStockError,
  InventoryAlreadyExistsError,
  InventoryError,
  InventoryNotFoundError,
  ProductNotFoundError,
  UnsupportedMovementTypeError,
} from "../types/inventory.errors.types.js";

export async function getStockMovementTypesController(
  _req: Request,
  res: Response,
): Promise<void> {
  res.status(200).json({ types: inventoryMovementTypes });
}

export async function getInventorySummaryController(
  req: Request,
  res: Response,
): Promise<void> {
  const authAccount = getRequiredAuthAccount(req, res);
  if (!authAccount) return;

  const summaries = await listInventorySummaries(authAccount.orgId);
  res.status(200).json({ inventory: summaries });
}

export async function getInventoryByProductController(
  req: Request,
  res: Response,
): Promise<void> {
  const authAccount = getRequiredAuthAccount(req, res);
  if (!authAccount) return;

  const productId = req.params.productId;

  if (typeof productId !== "string" || productId.length === 0) {
    res.status(400).json({ message: "Product ID is required" });
    return;
  }

  try {
    const inventory = await getInventorySummaryByProductId(
      productId,
      authAccount.orgId,
    );
    res.status(200).json({ inventory });
  } catch (error) {
    if (error instanceof ProductNotFoundError) {
      res.status(404).json({ message: error.message });
      return;
    }

    const message =
      error instanceof InventoryError ? error.message : "Failed to load inventory";

    res.status(500).json({ message });
  }
}

export async function createInventoryController(
  req: Request,
  res: Response,
): Promise<void> {
  const authAccount = getRequiredAuthAccount(req, res);
  if (!authAccount) return;

  const parsedBody = createInventorySchema.safeParse(req.body);

  if (!parsedBody.success) {
    res.status(400).json({
      message: "Invalid inventory create request",
      errors: parsedBody.error.flatten(),
    });
    return;
  }

  try {
    const result = await createInventoryBalance(authAccount.orgId, parsedBody.data);
    res.status(201).json(result);
  } catch (error) {
    if (error instanceof ProductNotFoundError) {
      res.status(404).json({ message: error.message });
      return;
    }

    if (error instanceof InventoryAlreadyExistsError) {
      res.status(409).json({ message: error.message });
      return;
    }

    const message =
      error instanceof InventoryError
        ? error.message
        : "Failed to create inventory";

    res.status(500).json({ message });
  }
}

export async function updateInventoryController(
  req: Request,
  res: Response,
): Promise<void> {
  const authAccount = getRequiredAuthAccount(req, res);
  if (!authAccount) return;

  const parsedParams = updateInventoryParamsSchema.safeParse(req.params);
  const parsedBody = updateInventorySchema.safeParse(req.body);

  if (!parsedParams.success || !parsedBody.success) {
    res.status(400).json({
      message: "Invalid inventory update request",
      errors: {
        params: parsedParams.success ? undefined : parsedParams.error.flatten(),
        body: parsedBody.success ? undefined : parsedBody.error.flatten(),
      },
    });
    return;
  }

  try {
    const result = await updateInventoryBalance(
      parsedParams.data.productId,
      authAccount.orgId,
      parsedBody.data,
    );
    res.status(200).json(result);
  } catch (error) {
    if (error instanceof ProductNotFoundError) {
      res.status(404).json({ message: error.message });
      return;
    }

    if (error instanceof InventoryNotFoundError) {
      res.status(404).json({ message: error.message });
      return;
    }

    const message =
      error instanceof InventoryError
        ? error.message
        : "Failed to update inventory";

    res.status(500).json({ message });
  }
}

export async function deleteInventoryController(
  req: Request,
  res: Response,
): Promise<void> {
  const authAccount = getRequiredAuthAccount(req, res);
  if (!authAccount) return;

  const parsedParams = deleteInventoryParamsSchema.safeParse(req.params);

  if (!parsedParams.success) {
    res.status(400).json({
      message: "Invalid inventory delete request",
      errors: parsedParams.error.flatten(),
    });
    return;
  }

  try {
    const result = await deleteInventoryBalance(
      parsedParams.data.productId,
      authAccount.orgId,
    );
    res.status(200).json(result);
  } catch (error) {
    if (error instanceof ProductNotFoundError) {
      res.status(404).json({ message: error.message });
      return;
    }

    if (error instanceof InventoryNotFoundError) {
      res.status(404).json({ message: error.message });
      return;
    }

    const message =
      error instanceof InventoryError
        ? error.message
        : "Failed to delete inventory";

    res.status(500).json({ message });
  }
}

export async function getStockMovementsController(
  req: Request,
  res: Response,
): Promise<void> {
  const authAccount = getRequiredAuthAccount(req, res);
  if (!authAccount) return;

  const parsedQuery = listStockMovementsQuerySchema.safeParse(req.query);

  if (!parsedQuery.success) {
    res.status(400).json({
      message: "Invalid stock movement query",
      errors: parsedQuery.error.flatten(),
    });
    return;
  }

  const result = await listStockMovements(authAccount.orgId, parsedQuery.data);
  res.status(200).json(result);
}

export async function createStockMovementController(
  req: Request,
  res: Response,
): Promise<void> {
  const authAccount = getRequiredAuthAccount(req, res);
  if (!authAccount) return;

  const parsedBody = createStockMovementSchema.safeParse(req.body);

  if (!parsedBody.success) {
    res.status(400).json({
      message: "Invalid stock movement request",
      errors: parsedBody.error.flatten(),
    });
    return;
  }

  try {
    const result = await recordStockMovement(
      authAccount.orgId,
      authAccount.id,
      parsedBody.data,
    );
    res.status(201).json(result);
  } catch (error) {
    if (error instanceof ProductNotFoundError) {
      res.status(404).json({ message: error.message });
      return;
    }

    if (error instanceof UnsupportedMovementTypeError) {
      res.status(400).json({ message: error.message });
      return;
    }

    if (error instanceof InsufficientStockError) {
      res.status(409).json({ message: error.message });
      return;
    }

    const message =
      error instanceof InventoryError
        ? error.message
        : "Failed to record stock movement";

    res.status(500).json({ message });
  }
}

export async function createInventoryAdjustmentController(
  req: Request,
  res: Response,
): Promise<void> {
  const authAccount = getRequiredAuthAccount(req, res);
  if (!authAccount) return;

  const parsedBody = createInventoryAdjustmentSchema.safeParse(req.body);

  if (!parsedBody.success) {
    res.status(400).json({
      message: "Invalid inventory adjustment request",
      errors: parsedBody.error.flatten(),
    });
    return;
  }

  try {
    const result = await recordInventoryAdjustment(
      authAccount.orgId,
      authAccount.id,
      parsedBody.data,
    );
    res.status(201).json(result);
  } catch (error) {
    if (error instanceof ProductNotFoundError) {
      res.status(404).json({ message: error.message });
      return;
    }

    if (error instanceof InsufficientStockError) {
      res.status(409).json({ message: error.message });
      return;
    }

    const message =
      error instanceof InventoryError
        ? error.message
        : "Failed to record inventory adjustment";

    res.status(500).json({ message });
  }
}
