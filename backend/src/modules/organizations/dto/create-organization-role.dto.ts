import { z } from "zod";

import { ALL_PERMISSIONS } from "../../auth/types/auth.permission.types.js";

export const createOrganizationRoleRequestSchema = z.object({
  name: z.string().trim().min(1).max(255),
  level: z.number().int().min(0).max(255),
  permissions: z
    .array(z.enum(ALL_PERMISSIONS))
    .min(1)
    .max(ALL_PERMISSIONS.length)
    .transform((permissions) => Array.from(new Set(permissions)).sort()),
});

export type CreateOrganizationRoleRequestDto = z.infer<
  typeof createOrganizationRoleRequestSchema
>;
