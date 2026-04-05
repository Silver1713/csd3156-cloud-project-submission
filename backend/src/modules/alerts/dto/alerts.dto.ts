import { z } from "zod";

export const alertStatusSchema = z.enum(["active", "acknowledged", "resolved"]);
export const alertTypeSchema = z.enum(["low_stock", "critical_stock", "custom"]);

export const listAlertsQuerySchema = z.object({
  status: alertStatusSchema.optional(),
  type: alertTypeSchema.optional(),
  productId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ListAlertsQueryDto = z.infer<typeof listAlertsQuerySchema>;

export const createAlertSchema = z
  .object({
    productId: z.string().uuid().optional().nullable(),
    triggeredByMovementId: z.string().uuid().optional().nullable(),
    alertDefinitionId: z.string().uuid().optional().nullable(),
    type: alertTypeSchema,
    status: alertStatusSchema.default("active"),
    thresholdQuantity: z.number().int().min(0).optional().nullable(),
    currentQuantity: z.number().int().min(0).optional().nullable(),
    message: z.string().trim().min(1).max(500).optional().nullable(),
  })
  .superRefine((value, ctx) => {
    if (!value.productId && !(value.type === "custom" && value.alertDefinitionId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["productId"],
        message:
          "productId is required unless this is a custom alert linked to an alert definition",
      });
    }

    if (value.alertDefinitionId && value.type !== "custom") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["alertDefinitionId"],
        message: "alertDefinitionId can only be used with custom alerts",
      });
    }
  });

export type CreateAlertDto = z.infer<typeof createAlertSchema>;

export const updateAlertSchema = z
  .object({
    status: alertStatusSchema.optional(),
    thresholdQuantity: z.number().int().min(0).optional().nullable(),
    currentQuantity: z.number().int().min(0).optional().nullable(),
    message: z.string().trim().min(1).max(500).optional().nullable(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one alert field must be provided",
  });

export type UpdateAlertDto = z.infer<typeof updateAlertSchema>;
