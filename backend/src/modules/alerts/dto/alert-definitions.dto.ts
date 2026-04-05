import { z } from "zod";
import {
  alertConditionNodeSchema,
  alertDefinitionScopeSchema,
  alertDefinitionSeveritySchema,
  countAlertConditionNodes,
  customMetricKeySchema,
} from "../../../shared/definition-engine/ast/alert-definition.ast.js";
export type { AlertConditionNode } from "../../../shared/definition-engine/ast/alert-definition.ast.js";

export const createAlertDefinitionSchema = z
  .object({
    key: customMetricKeySchema,
    name: z.string().trim().min(1).max(128),
    description: z.string().trim().max(500).optional().nullable(),
    severity: alertDefinitionSeveritySchema.default("medium"),
    scope: alertDefinitionScopeSchema.default("organization"),
    condition: alertConditionNodeSchema,
  })
  .superRefine((data, ctx) => {
    if (countAlertConditionNodes(data.condition) > 50) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["condition"],
        message: "Alert definition condition is too complex",
      });
    }
  });

export type CreateAlertDefinitionDto = z.infer<typeof createAlertDefinitionSchema>;

export const previewAlertDefinitionSchema = z.object({
  condition: alertConditionNodeSchema,
  scope: alertDefinitionScopeSchema.default("organization"),
  filters: z
    .object({
      q: z.string().trim().min(1).max(255).optional(),
      productId: z.string().uuid().optional(),
      categoryIds: z
        .string()
        .transform((value) =>
          value
            .split(",")
            .map((entry) => entry.trim())
            .filter((entry) => entry.length > 0),
        )
        .pipe(z.array(z.string().uuid()).min(1))
        .optional(),
      stockState: z.enum(["critical", "low", "healthy"]).optional(),
      criticalThreshold: z.coerce.number().int().min(0).optional(),
      lowThreshold: z.coerce.number().int().min(0).optional(),
      days: z.coerce.number().int().min(1).max(365).optional(),
    })
    .superRefine((data, ctx) => {
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
    })
    .optional(),
});

export type PreviewAlertDefinitionDto = z.infer<typeof previewAlertDefinitionSchema>;

export const updateAlertDefinitionSchema = z
  .object({
    name: z.string().trim().min(1).max(128).optional(),
    description: z.string().trim().max(500).optional().nullable(),
    severity: alertDefinitionSeveritySchema.optional(),
    scope: alertDefinitionScopeSchema.optional(),
    condition: alertConditionNodeSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one alert definition field must be provided",
  })
  .superRefine((data, ctx) => {
    if (data.condition && countAlertConditionNodes(data.condition) > 50) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["condition"],
        message: "Alert definition condition is too complex",
      });
    }
  });

export type UpdateAlertDefinitionDto = z.infer<typeof updateAlertDefinitionSchema>;
