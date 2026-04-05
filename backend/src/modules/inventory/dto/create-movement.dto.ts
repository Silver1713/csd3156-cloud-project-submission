import { z } from "zod";

import { inventoryMovementTypes } from "../types/inventory.movement.types.js";

export const createStockMovementSchema = z.object({
  productId: z.string().uuid(),
  type: z.enum(inventoryMovementTypes),
  quantity: z.number().int().positive(),
  reason: z.string().trim().min(1).max(500).optional(),
});

export type CreateStockMovementDto = z.infer<typeof createStockMovementSchema>;
