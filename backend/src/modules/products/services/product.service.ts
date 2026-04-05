/**
 * Owns product catalog reads and writes, including image-key validation and
 * managed image cleanup on replace/remove.
 */
import {
  countProductsByOwnerId,
  insertProduct,
  selectProductById,
  selectProductsByOwnerId,
  softDeleteProduct,
  updateProduct,
} from "../repositories/product.repository.js";
import { selectCategoryById } from "../../categories/repositories/categories.repository.js";
import type {
  CreateProductDto,
  ListProductsQueryDto,
  UpdateProductDto,
} from "../dto/product.dto.js";
import type { ProductListQuery, ProductRow } from "../types/product.db.types.js";
import { CategoryNotFoundError } from "../../categories/types/categories.errors.types.js";
import {
  deleteImageObject,
  isManagedImageObjectKey,
  isValidProductImageObjectKeyForOrganization,
  resolveStoredImageUrl,
} from "../../uploads/services/uploads.service.js";

type ProductServiceDependencies = {
  selectProductsByOwnerId: (query: ProductListQuery) => Promise<ProductRow[]>;
  countProductsByOwnerId: (
    query: Omit<ProductListQuery, "limit" | "offset">,
  ) => Promise<number>;
  selectProductById: (
    productId: string,
    ownerId: string,
  ) => Promise<ProductRow | null>;
  insertProduct: (input: {
    ownerId: string;
    productCategoryId?: string | null;
    name: string;
    description?: string | null;
    sku?: string | null;
    imageUrl?: string | null;
    imageObjectKey?: string | null;
    unitCost: number;
  }) => Promise<ProductRow>;
  updateProduct: (input: {
    id: string;
    ownerId: string;
    productCategoryId?: string | null;
    name: string;
    description?: string | null;
    sku?: string | null;
    imageUrl?: string | null;
    imageObjectKey?: string | null;
    unitCost: number;
  }) => Promise<ProductRow | null>;
  softDeleteProduct: (
    productId: string,
    ownerId: string,
  ) => Promise<ProductRow | null>;
  selectCategoryById: typeof selectCategoryById;
  resolveStoredImageUrl: typeof resolveStoredImageUrl;
  deleteImageObject: typeof deleteImageObject;
};

const productServiceDependencies: ProductServiceDependencies = {
  selectProductsByOwnerId,
  countProductsByOwnerId,
  selectProductById,
  insertProduct,
  updateProduct,
  softDeleteProduct,
  selectCategoryById,
  resolveStoredImageUrl,
  deleteImageObject,
};

export type Product = {
  id: string;
  ownerId: string | null;
  productCategoryId: string | null;
  name: string;
  description: string | null;
  sku: string | null;
  imageUrl: string | null;
  unitCost: number;
  createdAt: string;
  updatedAt: string;
};

export type ProductListResult = {
  products: Product[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
};

async function mapRowToProduct(
  row: ProductRow,
  dependencies: Pick<ProductServiceDependencies, "resolveStoredImageUrl">,
): Promise<Product> {
  return {
    id: row.id,
    ownerId: row.owner_id,
    productCategoryId: row.product_category_id,
    name: row.name,
    description: row.description,
    sku: row.sku,
    imageUrl: await dependencies.resolveStoredImageUrl(
      row.image_object_key,
      row.image_url,
    ),
    unitCost: Number(row.unit_cost),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function buildProductListQuery(
  ownerId: string,
  command: ListProductsQueryDto,
): ProductListQuery {
  const query: ProductListQuery = {
    ownerId,
    sortBy: command.sortBy,
    sortOrder: command.sortOrder,
    limit: command.limit,
    offset: command.offset,
  };

  const q = command.q?.trim();
  const sku = command.sku?.trim();
  const productCategoryId = command.productCategoryId?.trim();

  if (q) {
    query.q = q;
  }

  if (sku) {
    query.sku = sku;
  }

  if (productCategoryId) {
    query.productCategoryId = productCategoryId;
  }

  if (command.createdFrom) {
    query.createdFrom = command.createdFrom;
  }

  if (command.createdTo) {
    query.createdTo = command.createdTo;
  }

  if (command.updatedFrom) {
    query.updatedFrom = command.updatedFrom;
  }

  if (command.updatedTo) {
    query.updatedTo = command.updatedTo;
  }

  if (command.hasInventory !== undefined) {
    query.hasInventory = command.hasInventory;
  }

  if (command.minQuantity !== undefined) {
    query.minQuantity = command.minQuantity;
  }

  if (command.maxQuantity !== undefined) {
    query.maxQuantity = command.maxQuantity;
  }

  if (command.minUnitCost !== undefined) {
    query.minUnitCost = command.minUnitCost;
  }

  if (command.maxUnitCost !== undefined) {
    query.maxUnitCost = command.maxUnitCost;
  }

  return query;
}

function buildProductCountQuery(
  query: ProductListQuery,
): Omit<ProductListQuery, "limit" | "offset"> {
  const countQuery: Omit<ProductListQuery, "limit" | "offset"> = {
    ownerId: query.ownerId,
    sortBy: query.sortBy,
    sortOrder: query.sortOrder,
  };

  if (query.q) {
    countQuery.q = query.q;
  }

  if (query.sku) {
    countQuery.sku = query.sku;
  }

  if (query.productCategoryId) {
    countQuery.productCategoryId = query.productCategoryId;
  }

  if (query.createdFrom) {
    countQuery.createdFrom = query.createdFrom;
  }

  if (query.createdTo) {
    countQuery.createdTo = query.createdTo;
  }

  if (query.updatedFrom) {
    countQuery.updatedFrom = query.updatedFrom;
  }

  if (query.updatedTo) {
    countQuery.updatedTo = query.updatedTo;
  }

  if (query.hasInventory !== undefined) {
    countQuery.hasInventory = query.hasInventory;
  }

  if (query.minQuantity !== undefined) {
    countQuery.minQuantity = query.minQuantity;
  }

  if (query.maxQuantity !== undefined) {
    countQuery.maxQuantity = query.maxQuantity;
  }

  if (query.minUnitCost !== undefined) {
    countQuery.minUnitCost = query.minUnitCost;
  }

  if (query.maxUnitCost !== undefined) {
    countQuery.maxUnitCost = query.maxUnitCost;
  }

  return countQuery;
}

/**
 * Lists paginated products for an organization and resolves any stored image
 * object keys into client-consumable URLs.
 */
export async function listProducts(
  ownerId: string,
  command: ListProductsQueryDto,
  dependencies: ProductServiceDependencies = productServiceDependencies,
): Promise<ProductListResult> {
  const query = buildProductListQuery(ownerId, command);
  const [rows, total] = await Promise.all([
    dependencies.selectProductsByOwnerId(query),
    dependencies.countProductsByOwnerId(buildProductCountQuery(query)),
  ]);

  return {
    products: await Promise.all(
      rows.map((row) => mapRowToProduct(row, dependencies)),
    ),
    pagination: {
      limit: command.limit,
      offset: command.offset,
      total,
      hasMore: command.offset + rows.length < total,
    },
  };
}

/**
 * Returns a single product by id for the current organization.
 */
export async function getProductById(
  productId: string,
  ownerId: string,
  dependencies: ProductServiceDependencies = productServiceDependencies,
): Promise<Product | null> {
  const row = await dependencies.selectProductById(productId, ownerId);
  return row ? mapRowToProduct(row, dependencies) : null;
}

/**
 * Creates a product record after validating category ownership and any managed
 * image object key supplied by the client.
 */
export async function createProduct(
  ownerId: string,
  command: CreateProductDto,
  dependencies: ProductServiceDependencies = productServiceDependencies,
): Promise<Product> {
  let imageUrl: string | null = null;
  let imageObjectKey: string | null = null;

  if (command.productCategoryId) {
    const category = await dependencies.selectCategoryById(
      command.productCategoryId,
      ownerId,
    );

    if (!category) {
      throw new CategoryNotFoundError();
    }
  }

  if (command.imageObjectKey) {
    if (!isValidProductImageObjectKeyForOrganization(ownerId, command.imageObjectKey)) {
      throw new Error("Invalid product image object key");
    }

    imageObjectKey = command.imageObjectKey;
  }

  const row = await dependencies.insertProduct({
    ownerId,
    productCategoryId: command.productCategoryId ?? null,
    name: command.name.trim(),
    description: command.description ?? null,
    sku: command.sku?.trim() ?? null,
    imageUrl,
    imageObjectKey,
    unitCost: command.unitCost,
  });

  return mapRowToProduct(row, dependencies);
}

/**
 * Updates product metadata and handles image replacement/removal cleanup after
 * the database write succeeds.
 */
export async function updateProductDetails(
  productId: string,
  ownerId: string,
  command: UpdateProductDto,
  dependencies: ProductServiceDependencies = productServiceDependencies,
): Promise<Product | null> {
  const existingProductRow = await dependencies.selectProductById(productId, ownerId);

  if (!existingProductRow) {
    return null;
  }

  if (command.productCategoryId) {
    const category = await dependencies.selectCategoryById(
      command.productCategoryId,
      ownerId,
    );

    if (!category) {
      throw new CategoryNotFoundError();
    }
  }

  let imageUrl: string | null = existingProductRow.image_url;
  let imageObjectKey: string | null = existingProductRow.image_object_key;
  const previousImageObjectKey = existingProductRow.image_object_key;

  if (command.imageObjectKey === null) {
    imageUrl = null;
    imageObjectKey = null;
  } else if (command.imageObjectKey !== undefined) {
    if (!isValidProductImageObjectKeyForOrganization(ownerId, command.imageObjectKey)) {
      throw new Error("Invalid product image object key");
    }

    imageUrl = null;
    imageObjectKey = command.imageObjectKey;
  }

  const row = await dependencies.updateProduct({
    id: productId,
    ownerId,
    productCategoryId: command.productCategoryId ?? null,
    name: command.name.trim(),
    description: command.description ?? null,
    sku: command.sku?.trim() ?? null,
    imageUrl,
    imageObjectKey,
    unitCost: command.unitCost,
  });

  if (
    row &&
    previousImageObjectKey &&
    previousImageObjectKey !== imageObjectKey &&
    isManagedImageObjectKey(previousImageObjectKey)
  ) {
    await dependencies.deleteImageObject(previousImageObjectKey);
  }

  return row ? mapRowToProduct(row, dependencies) : null;
}

/**
 * Soft-deletes a product so downstream history remains intact.
 */
export async function deleteProductById(
  productId: string,
  ownerId: string,
  dependencies: ProductServiceDependencies = productServiceDependencies,
): Promise<Product | null> {
  const row = await dependencies.softDeleteProduct(productId, ownerId);
  return row ? mapRowToProduct(row, dependencies) : null;
}
