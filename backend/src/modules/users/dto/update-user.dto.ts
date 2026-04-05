import { z } from "zod";

export const updateCurrentUserRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(255).nullable().optional(),
    profileImageObjectKey: z.string().trim().min(1).max(1024).nullable().optional(),
  })
  .refine(
    (value) =>
      value.name !== undefined || value.profileImageObjectKey !== undefined,
    {
      message: "At least one updatable field is required",
    },
  );

export type UpdateCurrentUserRequestDto = z.infer<
  typeof updateCurrentUserRequestSchema
>;
