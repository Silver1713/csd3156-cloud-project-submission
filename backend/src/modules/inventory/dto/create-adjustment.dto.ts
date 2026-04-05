import { z } from "zod";

export const createInventoryAdjustmentSchema = z.object({
  productId: z.uuid(),
  direction: z.enum(["increase", "decrease"]),
  quantity: z.number().int().positive(),
  reason: z.string().trim().min(1).max(500),
});

export type CreateInventoryAdjustmentDto = z.infer<
  typeof createInventoryAdjustmentSchema
>;
