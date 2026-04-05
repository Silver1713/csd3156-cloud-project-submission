import { z } from "zod";

export const createProductImagePresignSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1).max(128),
});

export type CreateProductImagePresignDto = z.infer<
  typeof createProductImagePresignSchema
>;

export const createProfileImagePresignSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1).max(128),
});

export type CreateProfileImagePresignDto = z.infer<
  typeof createProfileImagePresignSchema
>;
