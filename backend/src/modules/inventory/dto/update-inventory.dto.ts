import { z } from "zod";

export const updateInventoryParamsSchema = z.object({
  productId: z.string().uuid(),
});

export const updateInventorySchema = z.object({
  quantity: z.number().int().min(0),
});

export type UpdateInventoryDto = z.infer<typeof updateInventorySchema>;
