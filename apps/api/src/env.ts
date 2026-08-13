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

  DATABASE_URL: z.url().refine((s) => s.startsWith('postgres') || s.startsWith('postgresql'), {
    message: 'DATABASE_URL must be a postgres connection string',
  }),

  // Direct (non-pooler) postgres URL. Used by `prisma migrate` —
  // Neon deployments need it because the pooler endpoint rejects
  // DDL transactions. Optional: docker dev falls back to
  // DATABASE_URL (handled in `packages/db/prisma.config.js`).
  // Empty string is allowed for the same reason.
  DIRECT_URL: z
    .string()
    .default('')
    .refine((s) => s === '' || s.startsWith('postgres') || s.startsWith('postgresql'), {
      message: 'DIRECT_URL must be a postgres connection string',
    }),

  // Redis URL for the in-process L1 + Redis L2 cache that wraps
  // Clerk BAPI calls. Optional — when unset, the api runs without
  // Redis (cache degrades to in-process L1 only, single-instance
  // friendly).
  REDIS_URL: z.url().default('redis://localhost:6379'),

  // Redis key prefix. Required convention for every fork: namespace
  // your cache keys so forks sharing a Redis cluster don't collide.
  // Default is the project name (`web-project-template-`). Override
  // per-environment if api + worker of one fork point at the same
  // Redis instance.
  REDIS_KEY_PREFIX: z.string().default('web-project-template-'),

  CORS_ORIGIN: z.string().default('http://localhost:3000').transform(csv),

  CLERK_SECRET_KEY: z.string().min(1),
  CLERK_PUBLISHABLE_KEY: z.string().min(1).default(''),
  CLERK_AUTHORIZED_PARTIES: z.string().default('http://localhost:3000').transform(csv),

  // Clerk webhook signing secret. Configure in the Clerk dashboard
  // (Webhooks → endpoint → Signing Secret) and paste here. The
  // `/webhooks/clerk` route uses `verifyWebhook` to authenticate
  // inbound events with this value.
  CLERK_WEBHOOK_SIGNING_SECRET: z.string().min(1).default('whsec_placeholder_set_me_in_dashboard'),

  // Toggle Prisma query event logging. Off by default to keep prod logs
  // focused on request lines.
  LOG_QUERIES: z
    .string()
    .optional()
    .transform((v) => v === 'true'),

  // Boot-time seed flag. `packages/db/prisma/seed.ts` runs at api
  // container start (after `prisma migrate deploy`) and creates one
  // admin user (`admin@template.test`) on an empty DB. Default `true`
  // so every fresh deployment gets a known-good account to validate
  // the sign-in / read pipeline end-to-end. Set to `false` to disable.
  // The api process itself never reads this value; it exists in env.ts
  // so the validation table is the single source of truth for env
  // vars. The seed script reads `process.env` directly because it runs
  // in prisma's CLI context.
  SEED_ENABLED: z
    .string()
    .default('true')
    .transform((v) => v === 'true'),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  // biome-ignore lint/suspicious/noConsole: logger isn't initialized yet — env is what it depends on
  console.error('[env] invalid configuration:', z.flattenError(parsed.error).fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
