// Sentry / GlitchTip edge-runtime initialization.
//
// Loaded by `instrumentation.ts` when `NEXT_RUNTIME === 'edge'`.
// Next 16's `proxy.ts` (Clerk middleware) runs in this runtime — this
// file is what catches errors thrown from middleware.
//
// Cannot import Node-only modules here (fs, etc.) — edge bundle is
// restricted. Keep imports minimal. Uses `@/lib/env/client` (not server)
// because edge can't import the server-only env module (CLERK_SECRET_KEY
// etc. are not edge-safe).
//
// Development gate — local dev must never track, regardless of DSN.

import * as Sentry from '@sentry/nextjs';
import { env as clientEnv } from '@/lib/env/client';

// Single gate — only init Sentry when the DSN is present. Deployed
// envs inject the DSN via Dokploy build args; dev never sets it, so
// the SDK stays uninitialised on the edge runtime.
if (clientEnv.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: clientEnv.NEXT_PUBLIC_SENTRY_DSN,
    environment: clientEnv.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
    tracesSampleRate: clientEnv.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE,
    release: clientEnv.NEXT_PUBLIC_SENTRY_RELEASE,
  });
}
