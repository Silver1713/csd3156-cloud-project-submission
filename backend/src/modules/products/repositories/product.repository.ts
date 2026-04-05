import { query } from "../../../db/client.js";
import type { ProductListQuery, ProductRow } from "../types/product.db.types.js";

function buildProductListFilters(
  input: Omit<ProductListQuery, "limit" | "offset">,
): {
  clauses: string[];
  values: unknown[];
} {
  const clauses = ["p.owner_id = $1", "p.deleted_at IS NULL"];
  const values: unknown[] = [input.ownerId];

  if (input.q) {
    values.push(`%${input.q}%`);
    const index = values.length;
    clauses.push(
      `(p.name ILIKE $${index} OR COALESCE(p.description, '') ILIKE $${index} OR COALESCE(p.sku, '') ILIKE $${index})`,
    );
  }

  if (input.sku) {
    values.push(input.sku);
    clauses.push(`p.sku = $${values.length}`);
  }

  if (input.productCategoryId) {
    values.push(input.productCategoryId);
    clauses.push(`p.product_category_id = $${values.length}`);
  }

  if (input.createdFrom) {
    values.push(input.createdFrom);
    clauses.push(`p.created_at >= $${values.length}`);
  }

  if (input.createdTo) {
    values.push(input.createdTo);
    clauses.push(`p.created_at <= $${values.length}`);
  }

  if (input.updatedFrom) {
    values.push(input.updatedFrom);
    clauses.push(`p.updated_at >= $${values.length}`);
  }

  if (input.updatedTo) {
    values.push(input.updatedTo);
    clauses.push(`p.updated_at <= $${values.length}`);
  }

  if (input.hasInventory === true) {
    clauses.push(`COALESCE(i.quantity, 0) > 0`);
  }

  if (input.hasInventory === false) {
    clauses.push(`COALESCE(i.quantity, 0) = 0`);
  }

  if (input.minQuantity !== undefined) {
    values.push(input.minQuantity);
    clauses.push(`COALESCE(i.quantity, 0) >= $${values.length}`);
  }

  if (input.maxQuantity !== undefined) {
    values.push(input.maxQuantity);
    clauses.push(`COALESCE(i.quantity, 0) <= $${values.length}`);
  }

  if (input.minUnitCost !== undefined) {
    values.push(input.minUnitCost);
    clauses.push(`p.unit_cost >= $${values.length}`);
  }

  if (input.maxUnitCost !== undefined) {
    values.push(input.maxUnitCost);
    clauses.push(`p.unit_cost <= $${values.length}`);
  }

  return { clauses, values };
}

function buildProductOrderBy(input: ProductListQuery): string {
  const sortColumnMap: Record<ProductListQuery["sortBy"], string> = {
    name: "p.name",
    sku: "p.sku",
    createdAt: "p.created_at",
    updatedAt: "p.updated_at",
    quantity: "COALESCE(i.quantity, 0)",
    unitCost: "p.unit_cost",
  };

  const direction = input.sortOrder.toUpperCase();
  const sortColumn = sortColumnMap[input.sortBy];

  return `${sortColumn} ${direction}, p.created_at DESC, p.id ASC`;
}

export async function selectProductsByOwnerId(
  input: ProductListQuery,
): Promise<ProductRow[]> {
  const { clauses, values } = buildProductListFilters(input);

  values.push(input.limit);
  const limitIndex = values.length;
  values.push(input.offset);
  const offsetIndex = values.length;

  return query<ProductRow>(
    `
      SELECT
        p.id,
        p.owner_id,
        p.product_category_id,
        p.name,
        p.description,
        p.sku,
        p.image_url,
        p.image_object_key,
        p.unit_cost,
        p.deleted_at,
        p.created_at,
        p.updated_at
      FROM inventory.products p
      LEFT JOIN inventory.inventory i ON i.product_id = p.id
      WHERE ${clauses.join(" AND ")}
      ORDER BY ${buildProductOrderBy(input)}
      LIMIT $${limitIndex}
      OFFSET $${offsetIndex}
    `,
    values,
  );
}

export async function countProductsByOwnerId(
  input: Omit<ProductListQuery, "limit" | "offset">,
): Promise<number> {
  const { clauses, values } = buildProductListFilters(input);

  const rows = await query<{ count: string }>(
    `
      SELECT COUNT(*)::text AS count
      FROM inventory.products p
      LEFT JOIN inventory.inventory i ON i.product_id = p.id
      WHERE ${clauses.join(" AND ")}
    `,
    values,
  );

  return Number(rows[0]?.count ?? 0);
}

export async function selectProductById(
  productId: string,
  ownerId: string,
): Promise<ProductRow | null> {
  const rows = await query<ProductRow>(
    `
      SELECT
        id,
        owner_id,
        product_category_id,
        name,
        description,
        sku,
        image_url,
        image_object_key,
        unit_cost,
        deleted_at,
        created_at,
        updated_at
      FROM inventory.products
      WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL
      LIMIT 1
    `,
    [productId, ownerId],
  );

  return rows[0] ?? null;
}

export type InsertProductInput = {
  ownerId: string;
  productCategoryId?: string | null;
  name: string;
  description?: string | null;
  sku?: string | null;
  imageUrl?: string | null;
  imageObjectKey?: string | null;
  unitCost: number;
};

export async function insertProduct(
  input: InsertProductInput,
): Promise<ProductRow> {
  const rows = await query<ProductRow>(
    `
      INSERT INTO inventory.products (owner_id, product_category_id, name, description, sku, image_url, image_object_key, unit_cost)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING
        id,
        owner_id,
        product_category_id,
        name,
        description,
        sku,
        image_url,
        image_object_key,
        unit_cost,
        deleted_at,
        created_at,
        updated_at
    `,
    [
      input.ownerId,
      input.productCategoryId ?? null,
      input.name,
      input.description ?? null,
      input.sku ?? null,
      input.imageUrl ?? null,
      input.imageObjectKey ?? null,
      input.unitCost,
    ],
  );

  const row = rows[0];

  if (!row) {
    throw new Error("Failed to create product");
  }

  return row;
}

export type UpdateProductInput = {
  id: string;
  ownerId: string;
  productCategoryId?: string | null;
  name: string;
  description?: string | null;
  sku?: string | null;
  imageUrl?: string | null;
  imageObjectKey?: string | null;
  unitCost: number;
};

export async function updateProduct(
  input: UpdateProductInput,
): Promise<ProductRow | null> {
  const rows = await query<ProductRow>(
    `
      UPDATE inventory.products
      SET
        name = $2,
        description = $3,
        sku = $4,
        image_url = $5,
        image_object_key = $6,
        product_category_id = $7,
        unit_cost = $8,
        updated_at = now()
      WHERE id = $1 AND owner_id = $9
      RETURNING
        id,
        owner_id,
        product_category_id,
        name,
        description,
        sku,
        image_url,
        image_object_key,
        unit_cost,
        deleted_at,
        created_at,
        updated_at
    `,
    [
      input.id,
      input.name,
      input.description ?? null,
      input.sku ?? null,
      input.imageUrl ?? null,
      input.imageObjectKey ?? null,
      input.productCategoryId ?? null,
      input.unitCost,
      input.ownerId,
    ],
  );

  return rows[0] ?? null;
}

export async function softDeleteProduct(
  productId: string,
  ownerId: string,
): Promise<ProductRow | null> {
  const rows = await query<ProductRow>(
    `
      UPDATE inventory.products
      SET
        deleted_at = now(),
        updated_at = now()
      WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL
      RETURNING
        id,
        owner_id,
        product_category_id,
        name,
        description,
        sku,
        image_url,
        image_object_key,
        unit_cost,
        deleted_at,
        created_at,
        updated_at
    `,
    [productId, ownerId],
  );

  return rows[0] ?? null;
}
