import { z } from "zod";

const sortBySchema = z.enum([
  "name",
  "sku",
  "createdAt",
  "updatedAt",
  "quantity",
  "unitCost",
]);

const sortOrderSchema = z.enum(["asc", "desc"]);

const queryBooleanSchema = z.preprocess((value) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (normalized === "true") {
      return true;
    }

    if (normalized === "false") {
      return false;
    }
  }

  return value;
}, z.boolean());

export const createProductSchema = z.object({
  name: z.string().min(1, "name is required"),
  description: z.string().max(2000).optional().nullable(),
  sku: z.string().max(128).optional().nullable(),
  imageObjectKey: z.string().min(1).max(1024).optional().nullable(),
  productCategoryId: z.string().uuid().optional().nullable(),
  unitCost: z.number().nonnegative(),
});

export type CreateProductDto = z.infer<typeof createProductSchema>;

export const listProductsQuerySchema = z
  .object({
    q: z.string().min(1).max(200).optional(),
    sku: z.string().min(1).max(128).optional(),
    productCategoryId: z.string().uuid().optional(),
    createdFrom: z.coerce.date().optional(),
    createdTo: z.coerce.date().optional(),
    updatedFrom: z.coerce.date().optional(),
    updatedTo: z.coerce.date().optional(),
    hasInventory: queryBooleanSchema.optional(),
    minQuantity: z.coerce.number().int().min(0).optional(),
    maxQuantity: z.coerce.number().int().min(0).optional(),
    minUnitCost: z.coerce.number().nonnegative().optional(),
    maxUnitCost: z.coerce.number().nonnegative().optional(),
    sortBy: sortBySchema.default("createdAt"),
    sortOrder: sortOrderSchema.default("desc"),
    limit: z.coerce.number().int().positive().max(200).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .superRefine((value, context) => {
    if (
      value.createdFrom &&
      value.createdTo &&
      value.createdFrom > value.createdTo
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["createdTo"],
        message: "createdTo must be greater than or equal to createdFrom",
      });
    }

    if (
      value.updatedFrom &&
      value.updatedTo &&
      value.updatedFrom > value.updatedTo
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["updatedTo"],
        message: "updatedTo must be greater than or equal to updatedFrom",
      });
    }

    if (
      value.minQuantity !== undefined &&
      value.maxQuantity !== undefined &&
      value.minQuantity > value.maxQuantity
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["maxQuantity"],
        message: "maxQuantity must be greater than or equal to minQuantity",
      });
    }

    if (
      value.minUnitCost !== undefined &&
      value.maxUnitCost !== undefined &&
      value.minUnitCost > value.maxUnitCost
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["maxUnitCost"],
        message: "maxUnitCost must be greater than or equal to minUnitCost",
      });
    }
  });

export type ListProductsQueryDto = z.infer<typeof listProductsQuerySchema>;

export const updateProductSchema = z.object({
  name: z.string().min(1, "name is required"),
  description: z.string().max(2000).optional().nullable(),
  sku: z.string().max(128).optional().nullable(),
  imageObjectKey: z.string().min(1).max(1024).optional().nullable(),
  productCategoryId: z.string().uuid().optional().nullable(),
  unitCost: z.number().nonnegative(),
});

export type UpdateProductDto = z.infer<typeof updateProductSchema>;
