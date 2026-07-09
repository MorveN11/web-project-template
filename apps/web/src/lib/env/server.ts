// Server-only env (no NEXT_PUBLIC_* here). Fail closed if a required
// secret is missing — better to boot-fail than serve with broken auth.
//
// This module is the ONLY place that reads `process.env`. Everywhere
// else in the web app imports from `@/lib/env/server` (server code) or
// `@/lib/env/client` (browser-safe code).

import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const env = createEnv({
  server: {
    CLERK_SECRET_KEY: z.string().min(1, 'CLERK_SECRET_KEY is required'),
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  },
  runtimeEnv: {
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
    NODE_ENV: process.env.NODE_ENV,
  },
  emptyStringAsUndefined: true,
});

/** True when the bundle is being built/ran in development (not production). */
export const isDev = env.NODE_ENV !== 'production';
