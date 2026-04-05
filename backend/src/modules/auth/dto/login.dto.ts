import { z } from "zod";

export const loginRequestSchema = z.object({
  username: z.string().min(1, "username is required"),
  password: z.string().min(1, "password is required"),
});

export type LoginRequestDto = z.infer<typeof loginRequestSchema>;
