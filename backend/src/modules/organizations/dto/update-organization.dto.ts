import { z } from "zod";

export const updateOrganizationParamsSchema = z.object({
  organizationId: z.uuid("organizationId must be a valid UUID"),
});

export const updateOrganizationRequestSchema = z.object({
  name: z.string().trim().min(1, "organization name is required").optional(),
  criticalStockThreshold: z.coerce
    .number()
    .int()
    .min(0, "criticalStockThreshold must be at least 0")
    .optional(),
  lowStockThreshold: z.coerce
    .number()
    .int()
    .min(0, "lowStockThreshold must be at least 0")
    .optional(),
}).superRefine((data, ctx) => {
  if (
    data.name === undefined &&
    data.criticalStockThreshold === undefined &&
    data.lowStockThreshold === undefined
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "At least one organization setting must be provided",
    });
  }

  if (
    data.criticalStockThreshold !== undefined &&
    data.lowStockThreshold !== undefined &&
    data.lowStockThreshold < data.criticalStockThreshold
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["lowStockThreshold"],
      message:
        "lowStockThreshold must be greater than or equal to criticalStockThreshold",
    });
  }
});

export type UpdateOrganizationParamsDto = z.infer<
  typeof updateOrganizationParamsSchema
>;

export type UpdateOrganizationRequestDto = z.infer<
  typeof updateOrganizationRequestSchema
>;
