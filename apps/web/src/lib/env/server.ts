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
    NODE_ENV: z.enum(['development', 'testing', 'production']).default('development'),
    CLERK_SECRET_KEY: z.string().min(1, 'CLERK_SECRET_KEY is required').default('sk_test_123'),
    // Build-time only — used by `withSentryConfig` to upload source
    // maps to GlitchTip. Never runtime; would leak via image history.
    SENTRY_AUTH_TOKEN: z.string().optional(),
  },
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
    SENTRY_AUTH_TOKEN: process.env.SENTRY_AUTH_TOKEN,
  },
  emptyStringAsUndefined: true,
});

/** True when the bundle is being built/ran in development (not production). */
export const isDev = env.NODE_ENV !== 'production';
