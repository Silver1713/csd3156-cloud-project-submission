import { z } from "zod";

export const createInventorySchema = z.object({
  productId: z.uuid(),
  quantity: z.number().int().min(0),
});

export type CreateInventoryDto = z.infer<typeof createInventorySchema>;
