import type { Request, Response } from "express";

import { getRequiredAuthAccount } from "../../../shared/http/get-required-auth-account.js";
import {
  createProduct,
  deleteProductById,
  getProductById,
  listProducts,
  updateProductDetails,
} from "../services/product.service.js";
import { CategoryNotFoundError } from "../../categories/types/categories.errors.types.js";
import {
  createProductSchema,
  listProductsQuerySchema,
  updateProductSchema,
} from "../dto/product.dto.js";

export async function listProductsController(
  req: Request,
  res: Response,
): Promise<void> {
  const authAccount = getRequiredAuthAccount(req, res);
  if (!authAccount) return;

  const parsedQuery = listProductsQuerySchema.safeParse(req.query);

  if (!parsedQuery.success) {
    res.status(400).json({
      message: "Invalid product query",
      errors: parsedQuery.error.flatten(),
    });
    return;
  }

  const result = await listProducts(authAccount.orgId, parsedQuery.data);
  res.status(200).json(result);
}

export async function getProductController(
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

  const product = await getProductById(productId, authAccount.orgId);

  if (!product) {
    res.status(404).json({ message: "Product not found" });
    return;
  }

  res.status(200).json({ product });
}

export async function createProductController(
  req: Request,
  res: Response,
): Promise<void> {
  const authAccount = getRequiredAuthAccount(req, res);
  if (!authAccount) return;

  const parsedBody = createProductSchema.safeParse(req.body);

  if (!parsedBody.success) {
    res.status(400).json({
      message: "Invalid product payload",
      errors: parsedBody.error.flatten(),
    });
    return;
  }

  try {
    const product = await createProduct(authAccount.orgId, parsedBody.data);
    res.status(201).json({ product });
  } catch (error) {
    if (error instanceof CategoryNotFoundError) {
      res.status(404).json({ message: error.message });
      return;
    }

    const message =
      error instanceof Error ? error.message : "Failed to create product";

    res.status(500).json({ message });
  }
}

export async function updateProductController(
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

  const parsedBody = updateProductSchema.safeParse(req.body);

  if (!parsedBody.success) {
    res.status(400).json({
      message: "Invalid product payload",
      errors: parsedBody.error.flatten(),
    });
    return;
  }

  let product;

  try {
    product = await updateProductDetails(
      productId,
      authAccount.orgId,
      parsedBody.data,
    );
  } catch (error) {
    if (error instanceof CategoryNotFoundError) {
      res.status(404).json({ message: error.message });
      return;
    }

    const message =
      error instanceof Error ? error.message : "Failed to update product";

    res.status(500).json({ message });
    return;
  }

  if (!product) {
    res.status(404).json({ message: "Product not found" });
    return;
  }

  res.status(200).json({ product });
}

export async function deleteProductController(
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

  const product = await deleteProductById(productId, authAccount.orgId);

  if (!product) {
    res.status(404).json({ message: "Product not found" });
    return;
  }

  res.status(200).json({ product });
}
