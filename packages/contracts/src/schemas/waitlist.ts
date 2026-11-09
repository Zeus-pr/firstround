import { z } from 'zod';

export const WaitlistRequest = z.object({
  email: z.string().min(3).max(254),
  intent: z.enum(['signup', 'login']).optional(),
});
export type WaitlistRequest = z.infer<typeof WaitlistRequest>;

export const WaitlistOk = z.object({
  ok: z.literal(true),
  already: z.boolean().optional(),
});
export type WaitlistOk = z.infer<typeof WaitlistOk>;

export const WaitlistError = z.object({
  error: z.string(),
});
export type WaitlistError = z.infer<typeof WaitlistError>;
