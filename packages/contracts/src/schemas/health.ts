import { z } from 'zod';

export const HealthOk = z.object({
  ok: z.literal(true),
  service: z.literal('firstround'),
  phase: z.string(),
});
export type HealthOk = z.infer<typeof HealthOk>;

export const HealthDbOk = z.object({
  ok: z.literal(true),
  database: z.literal('up'),
});
export type HealthDbOk = z.infer<typeof HealthDbOk>;

export const HealthDbDown = z.object({
  ok: z.literal(false),
  database: z.enum(['unconfigured', 'down']),
});
export type HealthDbDown = z.infer<typeof HealthDbDown>;
