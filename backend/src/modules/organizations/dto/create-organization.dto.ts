import { z } from "zod";

export const createOrganizationRequestSchema = z.object({
  name: z.string().trim().min(1, "organization name is required"),
});

export type CreateOrganizationRequestDto = z.infer<
  typeof createOrganizationRequestSchema
>;
