import { z } from "zod";

export const categoryParamsSchema = z.object({
  categoryId: z.string().uuid(),
});

export const createCategorySchema = z.object({
  name: z.string().trim().min(1, "category name is required"),
  parentId: z.string().uuid().optional().nullable(),
});

export const updateCategorySchema = z.object({
  name: z.string().trim().min(1, "category name is required"),
  parentId: z.string().uuid().optional().nullable(),
});
