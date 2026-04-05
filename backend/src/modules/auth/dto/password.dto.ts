import { z } from "zod";

export const updatePasswordRequestSchema = z.object({
  currentPassword: z.string().min(1, "currentPassword is required"),
  newPassword: z.string().min(1, "newPassword is required"),
});

export type UpdatePasswordRequestDto = z.infer<
  typeof updatePasswordRequestSchema
>;

export const resetPasswordRequestSchema = z.object({
  username: z.string().min(1, "username is required"),
  newPassword: z.string().min(1, "newPassword is required"),
});

export type ResetPasswordRequestDto = z.infer<
  typeof resetPasswordRequestSchema
>;
