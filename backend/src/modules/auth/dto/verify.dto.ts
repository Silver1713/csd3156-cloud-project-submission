import { z } from "zod";

export const verifyCognitoRequestSchema = z.object({
  accessToken: z.string().min(1, "accessToken is required"),
});

export type VerifyCognitoRequestDto = z.infer<
  typeof verifyCognitoRequestSchema
>;
