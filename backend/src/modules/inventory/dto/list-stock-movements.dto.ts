import { z } from "zod";

import { inventoryMovementTypes } from "../types/inventory.movement.types.js";

export const listStockMovementsQuerySchema = z.object({
  productId: z.string().uuid().optional(),
  actorId: z.string().uuid().optional(),
  type: z.enum(inventoryMovementTypes).optional(),
  createdFrom: z.coerce.date().optional(),
  createdTo: z.coerce.date().optional(),
  limit: z.coerce.number().int().positive().max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ListStockMovementsQueryDto = z.infer<
  typeof listStockMovementsQuerySchema
>;
