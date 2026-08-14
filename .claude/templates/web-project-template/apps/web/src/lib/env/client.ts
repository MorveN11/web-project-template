// Client-exposed env (NEXT_PUBLIC_* only). t3-oss rejects any non-NEXT_PUBLIC
// var here at build time, and it ships to the browser — keep secrets out.

import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const env = createEnv({
  client: {
    NEXT_PUBLIC_API_URL: z.url().default('http://localhost:4000'),
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1, 'CLERK publishable key is required').default('pk_test_123'),
    NEXT_PUBLIC_CLERK_SIGN_IN_URL: z.string().default('/auth/iniciar-sesion'),
    NEXT_PUBLIC_CLERK_SIGN_UP_URL: z.string().default('/auth/registro'),
    // Client-side log level. `debug` in dev, `warn` in prod by default —
    // debug/info logs ship input shapes that don't belong in prod
    // bundles. Override per-env via the build-time NEXT_PUBLIC_LOG_LEVEL
    // (it gets inlined into the JS, so it must be set at build time).
    NEXT_PUBLIC_LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('warn'),
    // ---------- error monitoring (GlitchTip / Sentry-compatible) ----------
    // Leave NEXT_PUBLIC_SENTRY_DSN empty to disable browser error
    // reporting entirely. All keys optional.
    NEXT_PUBLIC_SENTRY_DSN: z.url().optional(),
    // Drives the GlitchTip UI environment filter. `testing` for the
    // test branch, `production` for main, `development` for local.
    NEXT_PUBLIC_SENTRY_ENVIRONMENT: z.enum(['development', 'testing', 'production']).default('development'),
    // Fraction of transactions sent to GlitchTip (0.01 = 1%).
    NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0.01),
    // ---------- analytics (Umami) ----------
    // DEPLOYED ENVS ONLY — leave empty in dev (the NODE_ENV gate in
    // `umami-script.tsx` is independent of these values, so even a
    // stray URL from testing config cannot fire requests from a dev
    // build). Single website-id, per-env override via Dokploy build args.
    NEXT_PUBLIC_UMAMI_SCRIPT_URL: z.url().optional(),
    NEXT_PUBLIC_UMAMI_WEBSITE_ID: z.string().optional(),
    // Sentry release tag (git SHA / version). Optional — leave undefined
    // if not set; Sentry still works.
    NEXT_PUBLIC_SENTRY_RELEASE: z.string().optional(),
  },
  runtimeEnv: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    NEXT_PUBLIC_CLERK_SIGN_IN_URL: process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL,
    NEXT_PUBLIC_CLERK_SIGN_UP_URL: process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL,
    NEXT_PUBLIC_LOG_LEVEL: process.env.NEXT_PUBLIC_LOG_LEVEL,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_SENTRY_ENVIRONMENT: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
    NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE: process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE,
    NEXT_PUBLIC_UMAMI_SCRIPT_URL: process.env.NEXT_PUBLIC_UMAMI_SCRIPT_URL,
    NEXT_PUBLIC_UMAMI_WEBSITE_ID: process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID,
    NEXT_PUBLIC_SENTRY_RELEASE: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
  },
  emptyStringAsUndefined: true,
});
