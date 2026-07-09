// Process env parsed and validated at boot. Anything missing fails fast —
// no fake defaults, no lazy first-request 401s from a missing CLERK_SECRET_KEY.

import { z } from 'zod';

const csv = (v: string) =>
  v
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  DATABASE_URL: z
    .string()
    .url()
    .refine((s) => s.startsWith('postgres') || s.startsWith('postgresql'), {
      message: 'DATABASE_URL must be a postgres connection string',
    }),

  CORS_ORIGIN: z.string().default('http://localhost:3000').transform(csv),

  CLERK_SECRET_KEY: z.string().min(1),
  CLERK_PUBLISHABLE_KEY: z.string().min(1).default(''),
  CLERK_AUTHORIZED_PARTIES: z.string().default('http://localhost:3000').transform(csv),

  SEED_ENABLED: z
    .string()
    .optional()
    .transform((v) => v === 'true'),

  // Toggle Prisma query event logging. Off by default to keep prod logs
  // focused on request lines.
  LOG_QUERIES: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
});

const parsed = EnvSchema.safeParse(process.env);

// biome-ignore lint/suspicious/noConsole: logger isn't initialized yet — env is what it depends on
console.error('[env] invalid configuration:', parsed.error.flatten().fieldErrors);

if (!parsed.success) {
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
