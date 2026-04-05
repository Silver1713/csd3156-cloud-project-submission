import { query } from "../../../db/client.js";
import type { CategoryRow } from "../types/categories.db.types.js";

export async function selectCategoriesByOrgId(
  orgId: string,
): Promise<CategoryRow[]> {
  return query<CategoryRow>(
    `
      SELECT
        id,
        org_id,
        name,
        parent_id,
        created_at
      FROM inventory.categories
      WHERE org_id = $1
      ORDER BY name ASC, created_at ASC
    `,
    [orgId],
  );
}

export async function selectCategoryById(
  categoryId: string,
  orgId: string,
): Promise<CategoryRow | null> {
  const rows = await query<CategoryRow>(
    `
      SELECT
        id,
        org_id,
        name,
        parent_id,
        created_at
      FROM inventory.categories
      WHERE id = $1 AND org_id = $2
      LIMIT 1
    `,
    [categoryId, orgId],
  );

  return rows[0] ?? null;
}

export async function insertCategory(input: {
  orgId: string;
  name: string;
  parentId?: string | null;
}): Promise<CategoryRow> {
  const rows = await query<CategoryRow>(
    `
      INSERT INTO inventory.categories (org_id, name, parent_id)
      VALUES ($1, $2, $3)
      RETURNING
        id,
        org_id,
        name,
        parent_id,
        created_at
    `,
    [input.orgId, input.name, input.parentId ?? null],
  );

  const row = rows[0];

  if (!row) {
    throw new Error("Failed to create category");
  }

  return row;
}

export async function updateCategory(input: {
  id: string;
  orgId: string;
  name: string;
  parentId?: string | null;
}): Promise<CategoryRow | null> {
  const rows = await query<CategoryRow>(
    `
      UPDATE inventory.categories
      SET
        name = $3,
        parent_id = $4
      WHERE id = $1 AND org_id = $2
      RETURNING
        id,
        org_id,
        name,
        parent_id,
        created_at
    `,
    [input.id, input.orgId, input.name, input.parentId ?? null],
  );

  return rows[0] ?? null;
}

export async function deleteCategory(
  categoryId: string,
  orgId: string,
): Promise<CategoryRow | null> {
  const rows = await query<CategoryRow>(
    `
      DELETE FROM inventory.categories
      WHERE id = $1 AND org_id = $2
      RETURNING
        id,
        org_id,
        name,
        parent_id,
        created_at
    `,
    [categoryId, orgId],
  );

  return rows[0] ?? null;
}
