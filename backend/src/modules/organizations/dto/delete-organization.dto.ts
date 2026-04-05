import { z } from "zod";

export const deleteOrganizationParamsSchema = z.object({
  organizationId: z.uuid("organizationId must be a valid UUID"),
});

export type DeleteOrganizationParamsDto = z.infer<
  typeof deleteOrganizationParamsSchema
>;
