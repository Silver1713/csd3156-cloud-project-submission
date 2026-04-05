import { z } from "zod";

export const removeOrganizationMemberParamsSchema = z.object({
  accountId: z.uuid("accountId must be a valid UUID"),
});

export type RemoveOrganizationMemberParamsDto = z.infer<
  typeof removeOrganizationMemberParamsSchema
>;
