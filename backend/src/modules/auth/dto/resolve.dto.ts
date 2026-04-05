import { z } from "zod";

export const resolveCognitoSessionRequestSchema = z.object({
  accessToken: z.string().min(1, "accessToken is required"),
  idToken: z.string().min(1, "idToken is required"),
  joinKey: z.string().trim().optional(),
});

export type ResolveCognitoSessionRequestDto = z.infer<
  typeof resolveCognitoSessionRequestSchema
>;
