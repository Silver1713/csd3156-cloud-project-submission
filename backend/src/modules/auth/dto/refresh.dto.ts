import { z } from "zod";

export const refreshCognitoRequestSchema = z.object({
  refreshToken: z.string().min(1, "refreshToken is required"),
});

export type RefreshCognitoRequestDto = z.infer<
  typeof refreshCognitoRequestSchema
>;
