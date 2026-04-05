import { z } from "zod";
import {
  countMetricDefinitionNodes,
  metricDefinitionNodeSchema,
  metricFormatSchema,
  metricScopeSchema,
} from "../../../shared/definition-engine/ast/metric-definition.ast.js";

const stockStateSchema = z.enum(["critical", "low", "healthy"]);

const csvUuidArraySchema = z
  .string()
  .transform((value) =>
    value
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0),
  )
  .pipe(z.array(z.string().uuid()).min(1));

const thresholdFields = {
  criticalThreshold: z.coerce.number().int().min(0).optional(),
  lowThreshold: z.coerce.number().int().min(0).optional(),
};

const baseMetricsFilterSchema = z.object({
  q: z.string().trim().min(1).max(255).optional(),
  productId: z.string().uuid().optional(),
  categoryIds: csvUuidArraySchema.optional(),
  stockState: stockStateSchema.optional(),
  ...thresholdFields,
});

function validateThresholds<
  T extends {
    criticalThreshold?: number | undefined;
    lowThreshold?: number | undefined;
  },
>(data: T, ctx: z.RefinementCtx): void {
  if (
    data.criticalThreshold !== undefined &&
    data.lowThreshold !== undefined &&
    data.lowThreshold < data.criticalThreshold
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["lowThreshold"],
      message: "lowThreshold must be greater than or equal to criticalThreshold",
    });
  }
}

export const inventoryMovementTrendQuerySchema = baseMetricsFilterSchema.extend({
  days: z.coerce.number().int().min(1).max(30).default(7),
}).superRefine(validateThresholds);

export type InventoryMovementTrendQueryDto = z.infer<
  typeof inventoryMovementTrendQuerySchema
>;

export const inventoryCategoryBreakdownQuerySchema = baseMetricsFilterSchema.extend({
  top: z.coerce.number().int().min(1).max(10).default(5),
}).superRefine(validateThresholds);

export type InventoryCategoryBreakdownQueryDto = z.infer<
  typeof inventoryCategoryBreakdownQuerySchema
>;

export const inventoryMovementSummaryQuerySchema = baseMetricsFilterSchema.extend({
  days: z.coerce.number().int().min(1).max(365).optional(),
}).superRefine(validateThresholds);

export type InventoryMovementSummaryQueryDto = z.infer<
  typeof inventoryMovementSummaryQuerySchema
>;

export const inventoryOverviewQuerySchema =
  baseMetricsFilterSchema.superRefine(validateThresholds);

export type InventoryOverviewQueryDto = z.infer<
  typeof inventoryOverviewQuerySchema
>;

export const createMetricDefinitionSchema = z
  .object({
    key: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .regex(/^[a-z][a-z0-9_]*$/, {
        message: "key must be snake_case starting with a lowercase letter",
      }),
    name: z.string().trim().min(1).max(128),
    description: z.string().trim().max(500).optional().nullable(),
    scope: metricScopeSchema.default("organization"),
    format: metricFormatSchema.default("number"),
    definition: metricDefinitionNodeSchema,
  })
  .superRefine((data, ctx) => {
    if (countMetricDefinitionNodes(data.definition) > 50) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["definition"],
        message: "Metric definition is too complex",
      });
    }
  });

export type CreateMetricDefinitionDto = z.infer<typeof createMetricDefinitionSchema>;

export const updateMetricDefinitionSchema = z
  .object({
    key: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .regex(/^[a-z][a-z0-9_]*$/, {
        message: "key must be snake_case starting with a lowercase letter",
      })
      .optional(),
    name: z.string().trim().min(1).max(128).optional(),
    description: z.string().trim().max(500).optional().nullable(),
    scope: metricScopeSchema.optional(),
    format: metricFormatSchema.optional(),
    definition: metricDefinitionNodeSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one metric definition field must be provided",
  })
  .superRefine((data, ctx) => {
    if (
      data.definition !== undefined &&
      countMetricDefinitionNodes(data.definition) > 50
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["definition"],
        message: "Metric definition is too complex",
      });
    }
  });

export type UpdateMetricDefinitionDto = z.infer<typeof updateMetricDefinitionSchema>;

export const previewMetricDefinitionSchema = z.object({
  definition: metricDefinitionNodeSchema,
  filters: z
    .object({
      q: z.string().trim().min(1).max(255).optional(),
      productId: z.string().uuid().optional(),
      categoryIds: csvUuidArraySchema.optional(),
      stockState: stockStateSchema.optional(),
      criticalThreshold: z.coerce.number().int().min(0).optional(),
      lowThreshold: z.coerce.number().int().min(0).optional(),
      days: z.coerce.number().int().min(1).max(365).optional(),
    })
    .superRefine(validateThresholds)
    .optional(),
});

export type PreviewMetricDefinitionDto = z.infer<typeof previewMetricDefinitionSchema>;
