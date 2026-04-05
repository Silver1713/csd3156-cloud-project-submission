import { z } from "zod";

export const updateOrganizationMemberParamsSchema = z.object({
  accountId: z.uuid("accountId must be a valid UUID"),
});

export const updateOrganizationMemberRequestSchema = z.object({
  roleId: z.uuid("roleId must be a valid UUID").nullable(),
});

export type UpdateOrganizationMemberParamsDto = z.infer<
  typeof updateOrganizationMemberParamsSchema
>;

export type UpdateOrganizationMemberRequestDto = z.infer<
  typeof updateOrganizationMemberRequestSchema
>;
