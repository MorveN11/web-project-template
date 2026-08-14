// Sentry / GlitchTip Node-runtime initialization (server + API routes + RSC).
//
// Loaded by `instrumentation.ts` when `NEXT_RUNTIME === 'nodejs'`.
// Sends directly to GlitchTip (no tunnel — server-side fetch isn't
// subject to ad-blockers or browser CSP).
//
// Single gate — only init Sentry when the DSN is present. Deployed
// envs inject the DSN via Dokploy runtime env; dev never sets it, so
// the SDK stays uninitialised. Server code uses BOTH env modules:
// `clientEnv` for `NEXT_PUBLIC_*` (defined in client schema; Next.js
// inlines at build time so the server bundle reads them), `serverEnv`
// for server-only vars like NODE_ENV.

import * as Sentry from '@sentry/nextjs';
import { env as clientEnv } from '@/lib/env/client';
import { env as serverEnv } from '@/lib/env/server';

if (clientEnv.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: clientEnv.NEXT_PUBLIC_SENTRY_DSN,
    environment: clientEnv.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? serverEnv.NODE_ENV,
    tracesSampleRate: clientEnv.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE,
    release: clientEnv.NEXT_PUBLIC_SENTRY_RELEASE,
  });
}
