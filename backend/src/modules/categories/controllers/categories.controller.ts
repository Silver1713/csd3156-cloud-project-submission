import type { Request, Response } from "express";

import { getRequiredAuthAccount } from "../../../shared/http/get-required-auth-account.js";
import {
  categoryParamsSchema,
  createCategorySchema,
  updateCategorySchema,
} from "../dto/category.dto.js";
import {
  createCategoryForOrg,
  deleteCategoryForOrg,
  getCategoryById,
  listCategories,
  updateCategoryForOrg,
} from "../services/categories.service.js";
import {
  CategoryDeleteBlockedError,
  CategoryError,
  CategoryNotFoundError,
} from "../types/categories.errors.types.js";

export async function listCategoriesController(
  req: Request,
  res: Response,
): Promise<void> {
  const authAccount = getRequiredAuthAccount(req, res);
  if (!authAccount) return;

  const result = await listCategories(authAccount.orgId);
  res.status(200).json(result);
}

export async function getCategoryController(
  req: Request,
  res: Response,
): Promise<void> {
  const authAccount = getRequiredAuthAccount(req, res);
  if (!authAccount) return;

  const parsedParams = categoryParamsSchema.safeParse(req.params);

  if (!parsedParams.success) {
    res.status(400).json({
      message: "Invalid category request",
      errors: parsedParams.error.flatten(),
    });
    return;
  }

  try {
    const result = await getCategoryById(
      parsedParams.data.categoryId,
      authAccount.orgId,
    );
    res.status(200).json(result);
  } catch (error) {
    if (error instanceof CategoryNotFoundError) {
      res.status(404).json({ message: error.message });
      return;
    }

    const message =
      error instanceof CategoryError ? error.message : "Failed to load category";

    res.status(500).json({ message });
  }
}

export async function createCategoryController(
  req: Request,
  res: Response,
): Promise<void> {
  const authAccount = getRequiredAuthAccount(req, res);
  if (!authAccount) return;

  const parsedBody = createCategorySchema.safeParse(req.body);

  if (!parsedBody.success) {
    res.status(400).json({
      message: "Invalid category create request",
      errors: parsedBody.error.flatten(),
    });
    return;
  }

  try {
    const result = await createCategoryForOrg(authAccount.orgId, parsedBody.data);
    res.status(201).json(result);
  } catch (error) {
    if (error instanceof CategoryNotFoundError) {
      res.status(404).json({ message: error.message });
      return;
    }

    const message =
      error instanceof CategoryError ? error.message : "Failed to create category";

    res.status(400).json({ message });
  }
}

export async function updateCategoryController(
  req: Request,
  res: Response,
): Promise<void> {
  const authAccount = getRequiredAuthAccount(req, res);
  if (!authAccount) return;

  const parsedParams = categoryParamsSchema.safeParse(req.params);
  const parsedBody = updateCategorySchema.safeParse(req.body);

  if (!parsedParams.success || !parsedBody.success) {
    res.status(400).json({
      message: "Invalid category update request",
      errors: {
        params: parsedParams.success ? undefined : parsedParams.error.flatten(),
        body: parsedBody.success ? undefined : parsedBody.error.flatten(),
      },
    });
    return;
  }

  try {
    const result = await updateCategoryForOrg(
      parsedParams.data.categoryId,
      authAccount.orgId,
      parsedBody.data,
    );
    res.status(200).json(result);
  } catch (error) {
    if (error instanceof CategoryNotFoundError) {
      res.status(404).json({ message: error.message });
      return;
    }

    const message =
      error instanceof CategoryError ? error.message : "Failed to update category";

    res.status(400).json({ message });
  }
}

export async function deleteCategoryController(
  req: Request,
  res: Response,
): Promise<void> {
  const authAccount = getRequiredAuthAccount(req, res);
  if (!authAccount) return;

  const parsedParams = categoryParamsSchema.safeParse(req.params);

  if (!parsedParams.success) {
    res.status(400).json({
      message: "Invalid category delete request",
      errors: parsedParams.error.flatten(),
    });
    return;
  }

  try {
    const result = await deleteCategoryForOrg(
      parsedParams.data.categoryId,
      authAccount.orgId,
    );
    res.status(200).json(result);
  } catch (error) {
    if (error instanceof CategoryNotFoundError) {
      res.status(404).json({ message: error.message });
      return;
    }

    if (error instanceof CategoryDeleteBlockedError) {
      res.status(409).json({ message: error.message });
      return;
    }

    const message =
      error instanceof CategoryError ? error.message : "Failed to delete category";

    res.status(500).json({ message });
  }
}
