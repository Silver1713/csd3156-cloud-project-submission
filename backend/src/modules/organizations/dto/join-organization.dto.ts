import { z } from "zod";

export const joinOrganizationRequestSchema = z.object({
  joinKey: z.string().trim().min(1),
});
