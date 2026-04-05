import {
  deleteCategory,
  insertCategory,
  selectCategoriesByOrgId,
  selectCategoryById,
  updateCategory,
} from "../repositories/categories.repository.js";
import type {
  Category,
  CreateCategoryCommand,
  UpdateCategoryCommand,
} from "../types/categories.command.types.js";
import type { CategoryRow } from "../types/categories.db.types.js";
import {
  CategoryDeleteBlockedError,
  CategoryNotFoundError,
} from "../types/categories.errors.types.js";

type CategoriesServiceDependencies = {
  selectCategoriesByOrgId: typeof selectCategoriesByOrgId;
  selectCategoryById: typeof selectCategoryById;
  insertCategory: typeof insertCategory;
  updateCategory: typeof updateCategory;
  deleteCategory: typeof deleteCategory;
};

const defaultDependencies: CategoriesServiceDependencies = {
  selectCategoriesByOrgId,
  selectCategoryById,
  insertCategory,
  updateCategory,
  deleteCategory,
};

function mapCategoryRow(row: CategoryRow): Category {
  return {
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    parentId: row.parent_id,
    createdAt: row.created_at.toISOString(),
  };
}

async function ensureScopedParentCategory(
  orgId: string,
  parentId: string | null | undefined,
  dependencies: CategoriesServiceDependencies,
): Promise<void> {
  if (!parentId) {
    return;
  }

  const parent = await dependencies.selectCategoryById(parentId, orgId);

  if (!parent) {
    throw new CategoryNotFoundError("Parent category not found");
  }
}

export async function listCategories(
  orgId: string,
  dependencies: CategoriesServiceDependencies = defaultDependencies,
): Promise<{ categories: Category[] }> {
  const rows = await dependencies.selectCategoriesByOrgId(orgId);
  return { categories: rows.map(mapCategoryRow) };
}

export async function getCategoryById(
  categoryId: string,
  orgId: string,
  dependencies: CategoriesServiceDependencies = defaultDependencies,
): Promise<{ category: Category }> {
  const row = await dependencies.selectCategoryById(categoryId, orgId);

  if (!row) {
    throw new CategoryNotFoundError();
  }

  return { category: mapCategoryRow(row) };
}

export async function createCategoryForOrg(
  orgId: string,
  command: CreateCategoryCommand,
  dependencies: CategoriesServiceDependencies = defaultDependencies,
): Promise<{ category: Category }> {
  await ensureScopedParentCategory(orgId, command.parentId, dependencies);

  const row = await dependencies.insertCategory({
    orgId,
    name: command.name.trim(),
    parentId: command.parentId ?? null,
  });

  return { category: mapCategoryRow(row) };
}

export async function updateCategoryForOrg(
  categoryId: string,
  orgId: string,
  command: UpdateCategoryCommand,
  dependencies: CategoriesServiceDependencies = defaultDependencies,
): Promise<{ category: Category }> {
  if (command.parentId === categoryId) {
    throw new CategoryNotFoundError("Category cannot be its own parent");
  }

  await ensureScopedParentCategory(orgId, command.parentId, dependencies);

  const row = await dependencies.updateCategory({
    id: categoryId,
    orgId,
    name: command.name.trim(),
    parentId: command.parentId ?? null,
  });

  if (!row) {
    throw new CategoryNotFoundError();
  }

  return { category: mapCategoryRow(row) };
}

export async function deleteCategoryForOrg(
  categoryId: string,
  orgId: string,
  dependencies: CategoriesServiceDependencies = defaultDependencies,
): Promise<{ category: Category }> {
  try {
    const row = await dependencies.deleteCategory(categoryId, orgId);

    if (!row) {
      throw new CategoryNotFoundError();
    }

    return { category: mapCategoryRow(row) };
  } catch (error) {
    if (
      error instanceof Error
      && "code" in error
      && (error as { code?: string }).code === "23503"
    ) {
      throw new CategoryDeleteBlockedError();
    }

    throw error;
  }
}
