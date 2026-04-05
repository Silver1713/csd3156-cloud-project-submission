import test from "node:test";
import assert from "node:assert/strict";

import {
  createProduct,
  deleteProductById,
  getProductById,
  listProducts,
  updateProductDetails,
} from "../services/product.service.js";

process.env.AWS_REGION ??= "us-east-1";
process.env.S3_PRODUCT_IMAGE_BUCKET ??= "replace-with-s3-bucket-name";

type ProductWriteInput = {
  ownerId: string;
  productCategoryId?: string | null;
  name: string;
  description?: string | null;
  sku?: string | null;
  imageUrl?: string | null;
  unitCost: number;
};

type ProductUpdateInput = ProductWriteInput & {
  id: string;
};

const ownerId = "11111111-1111-1111-1111-111111111111";
const productId = "22222222-2222-2222-2222-222222222222";
const productCategoryId = "33333333-3333-3333-3333-333333333333";

const sampleProductRow = {
  id: productId,
  owner_id: ownerId,
  product_category_id: productCategoryId,
  name: "Widget",
  description: "Useful widget",
  sku: "WGT-001",
  image_url: "https://example.com/widget.jpg",
  image_object_key: null,
  unit_cost: "19.99",
  deleted_at: null,
  created_at: new Date("2026-03-29T00:00:00.000Z"),
  updated_at: new Date("2026-03-29T00:00:00.000Z"),
};

function createDeps(overrides: Record<string, unknown> = {}) {
  return {
    selectProductsByOwnerId: async (_query: {
      ownerId: string;
      q?: string;
      sku?: string;
      productCategoryId?: string;
      createdFrom?: Date;
      createdTo?: Date;
      updatedFrom?: Date;
      updatedTo?: Date;
      hasInventory?: boolean;
      minQuantity?: number;
      maxQuantity?: number;
      minUnitCost?: number;
      maxUnitCost?: number;
      sortBy:
        | "name"
        | "sku"
        | "createdAt"
        | "updatedAt"
        | "quantity"
        | "unitCost";
      sortOrder: "asc" | "desc";
      limit: number;
      offset: number;
    }) => [sampleProductRow],
    countProductsByOwnerId: async () => 1,
    selectProductById: async (_productId: string, _ownerId: string) =>
      sampleProductRow,
    selectCategoryById: async (_categoryId: string, _ownerId: string) => ({
      id: productCategoryId,
      org_id: ownerId,
      name: "General",
      parent_id: null,
      created_at: new Date("2026-03-29T00:00:00.000Z"),
    }),
    insertProduct: async (input: {
      ownerId: string;
      productCategoryId?: string | null;
      name: string;
      description?: string | null;
      sku?: string | null;
      imageUrl?: string | null;
      unitCost: number;
    }) => ({
      ...sampleProductRow,
      owner_id: input.ownerId,
      name: input.name,
      description: input.description ?? null,
      sku: input.sku ?? null,
    }),
    updateProduct: async (input: {
      id: string;
      ownerId: string;
      productCategoryId?: string | null;
      name: string;
      description?: string | null;
      sku?: string | null;
      imageUrl?: string | null;
      imageObjectKey?: string | null;
      unitCost: number;
    }) => ({
      ...sampleProductRow,
      id: input.id,
      owner_id: input.ownerId,
      name: input.name,
      description: input.description ?? null,
      sku: input.sku ?? null,
    }),
    softDeleteProduct: async (_productId: string, _ownerId: string) => ({
      ...sampleProductRow,
      deleted_at: new Date("2026-04-02T00:00:00.000Z"),
    }),
    resolveStoredImageUrl: async (objectKey: string | null | undefined, fallbackUrl: string | null | undefined) =>
      objectKey ? `signed:${objectKey}` : (fallbackUrl ?? null),
    deleteImageObject: async () => undefined,
    ...overrides,
  };
}

test("listProducts scopes repository access by organization owner id", async () => {
  let capturedQuery:
    | {
        ownerId: string;
        q?: string;
        sku?: string;
        productCategoryId?: string;
        createdFrom?: Date;
        createdTo?: Date;
        updatedFrom?: Date;
        updatedTo?: Date;
        hasInventory?: boolean;
        minQuantity?: number;
        maxQuantity?: number;
        minUnitCost?: number;
        maxUnitCost?: number;
        sortBy:
          | "name"
          | "sku"
          | "createdAt"
          | "updatedAt"
          | "quantity"
          | "unitCost";
        sortOrder: "asc" | "desc";
        limit: number;
        offset: number;
      }
    | null = null;

  const result = await listProducts(
    ownerId,
    {
      q: "widget",
      sku: "WGT-001",
      productCategoryId,
      hasInventory: true,
      minQuantity: 5,
      maxQuantity: 25,
      minUnitCost: 10,
      maxUnitCost: 40,
      sortBy: "unitCost",
      sortOrder: "asc",
      limit: 25,
      offset: 10,
    },
    createDeps({
      selectProductsByOwnerId: async (receivedQuery: {
        ownerId: string;
        q?: string;
        sku?: string;
        productCategoryId?: string;
        createdFrom?: Date;
        createdTo?: Date;
        updatedFrom?: Date;
        updatedTo?: Date;
        hasInventory?: boolean;
        minQuantity?: number;
        maxQuantity?: number;
        minUnitCost?: number;
        maxUnitCost?: number;
        sortBy:
          | "name"
          | "sku"
          | "createdAt"
          | "updatedAt"
          | "quantity"
          | "unitCost";
        sortOrder: "asc" | "desc";
        limit: number;
        offset: number;
      }) => {
        capturedQuery = receivedQuery;
        return [sampleProductRow];
      },
    }),
  );

  assert.deepEqual(capturedQuery, {
    ownerId,
    q: "widget",
    sku: "WGT-001",
    productCategoryId,
    hasInventory: true,
    minQuantity: 5,
    maxQuantity: 25,
    minUnitCost: 10,
    maxUnitCost: 40,
    sortBy: "unitCost",
    sortOrder: "asc",
    limit: 25,
    offset: 10,
  });
  assert.equal(result.products.length, 1);
  assert.equal(result.products[0]?.ownerId, ownerId);
  assert.equal(result.pagination.total, 1);
  assert.equal(result.pagination.hasMore, false);
});

test("getProductById returns null when repository finds no product in the organization scope", async () => {
  const result = await getProductById(
    productId,
    ownerId,
    createDeps({
      selectProductById: async () => null,
    }),
  );

  assert.equal(result, null);
});

test("createProduct trims fields and injects organization owner id from caller context", async () => {
  let capturedInput: {
    ownerId: string;
    productCategoryId?: string | null;
    name: string;
    description?: string | null;
    sku?: string | null;
    imageObjectKey?: string | null;
    unitCost: number;
  } | null = null;

  const result = await createProduct(
    ownerId,
    {
      name: "  Widget  ",
      description: "Description",
      sku: "  WGT-001  ",
      imageObjectKey: `images/products/${ownerId}/widget-updated.jpg`,
      productCategoryId,
      unitCost: 24.5,
    },
    createDeps({
      insertProduct: async (input: ProductWriteInput) => {
        capturedInput = input;
        return {
          ...sampleProductRow,
          owner_id: input.ownerId,
          product_category_id: input.productCategoryId ?? null,
          name: input.name,
          description: input.description ?? null,
          sku: input.sku ?? null,
        };
      },
    }),
  );

  assert.deepEqual(capturedInput, {
    ownerId,
    productCategoryId,
    name: "Widget",
    description: "Description",
    sku: "WGT-001",
    imageUrl: null,
    imageObjectKey: "images/products/11111111-1111-1111-1111-111111111111/widget-updated.jpg",
    unitCost: 24.5,
  });
  assert.equal(result.ownerId, ownerId);
  assert.equal(result.productCategoryId, productCategoryId);
  assert.equal(result.unitCost, 19.99);
});

test("updateProductDetails scopes updates by organization owner id", async () => {
  let capturedInput: {
    id: string;
    ownerId: string;
    productCategoryId?: string | null;
    name: string;
    description?: string | null;
    sku?: string | null;
    imageObjectKey?: string | null;
    unitCost: number;
  } | null = null;

  const result = await updateProductDetails(
    productId,
    ownerId,
    {
      name: "  Updated Widget  ",
      description: null,
      sku: "  WGT-002  ",
      imageObjectKey: `images/products/${ownerId}/widget-2.jpg`,
      productCategoryId: null,
      unitCost: 31.25,
    },
    createDeps({
      updateProduct: async (input: ProductUpdateInput) => {
        capturedInput = input;
        return {
          ...sampleProductRow,
          id: input.id,
          owner_id: input.ownerId,
          product_category_id: input.productCategoryId ?? null,
          name: input.name,
          description: input.description ?? null,
          sku: input.sku ?? null,
        };
      },
    }),
  );

  assert.deepEqual(capturedInput, {
    id: productId,
    ownerId,
    productCategoryId: null,
    name: "Updated Widget",
    description: null,
    sku: "WGT-002",
    imageUrl: null,
    imageObjectKey: "images/products/11111111-1111-1111-1111-111111111111/widget-2.jpg",
    unitCost: 31.25,
  });
  assert.equal(result?.id, productId);
  assert.equal(result?.ownerId, ownerId);
  assert.equal(result?.productCategoryId, null);
  assert.equal(result?.unitCost, 19.99);
});

test("deleteProductById soft deletes within the organization scope", async () => {
  let capturedProductId: string | null = null;
  let capturedOwnerId: string | null = null;

  const result = await deleteProductById(
    productId,
    ownerId,
    createDeps({
      softDeleteProduct: async (receivedProductId: string, receivedOwnerId: string) => {
        capturedProductId = receivedProductId;
        capturedOwnerId = receivedOwnerId;
        return {
          ...sampleProductRow,
          deleted_at: new Date("2026-04-02T00:00:00.000Z"),
        };
      },
    }),
  );

  assert.equal(capturedProductId, productId);
  assert.equal(capturedOwnerId, ownerId);
  assert.equal(result?.id, productId);
});
