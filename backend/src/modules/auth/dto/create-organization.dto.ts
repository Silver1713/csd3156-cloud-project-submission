import { z } from "zod";

export const createOrganizationRequestSchema = z.object({
  name: z.string().min(1, "organization name is required"),
});

export type CreateOrganizationRequestDto = z.infer<
  typeof createOrganizationRequestSchema
>;
