import { z } from "zod";

export const registerRequestSchema = z.object({
  orgId: z.uuid("orgId must be a valid UUID"),
  email: z.email("email must be valid"),
  username: z.string().min(1, "username is required"),
  password: z.string().min(1, "password is required"),
  roleId: z.uuid("roleId must be a valid UUID").nullable().optional(),
});

export type RegisterRequestDto = z.infer<typeof registerRequestSchema>;
