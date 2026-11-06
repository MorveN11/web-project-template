// Sentry / GlitchTip edge-runtime initialization.
/** biome-ignore-all lint/suspicious/noConsole: 'Sentry Logs' */
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
import { NO_PII_DATA_COLLECTION, scrubEvent } from '@/lib/sentry-scrub';

// Single gate — only init Sentry when the DSN is present. Deployed
// envs inject the DSN via Dokploy build args; dev never sets it, so
// the SDK stays uninitialised on the edge runtime.
if (clientEnv.NEXT_PUBLIC_SENTRY_DSN) {
  try {
    Sentry.init({
      dsn: clientEnv.NEXT_PUBLIC_SENTRY_DSN,
      environment: clientEnv.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
      tracesSampleRate: clientEnv.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE,
      release: clientEnv.NEXT_PUBLIC_SENTRY_RELEASE,
      dataCollection: NO_PII_DATA_COLLECTION,
      beforeSend: scrubEvent,
    });
    const dsnHost = new URL(clientEnv.NEXT_PUBLIC_SENTRY_DSN).host;
    console.info('[sentry] initialised (edge)', {
      dsn_host: dsnHost,
      environment: clientEnv.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
      release: clientEnv.NEXT_PUBLIC_SENTRY_RELEASE,
    });
  } catch (err) {
    console.error('[sentry] init failed (edge)', err);
  }
} else {
  console.info('[sentry] disabled (edge) — NEXT_PUBLIC_SENTRY_DSN empty');
}
