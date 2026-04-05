import { z } from "zod";

export const deleteInventoryParamsSchema = z.object({
  productId: z.string().uuid(),
});
