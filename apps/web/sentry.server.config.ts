// Sentry / GlitchTip Node-runtime initialization (server + API routes + RSC).
/** biome-ignore-all lint/suspicious/noConsole: 'Sentry Logs' */
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
import { NO_PII_DATA_COLLECTION, scrubEvent } from '@/lib/sentry-scrub';

if (clientEnv.NEXT_PUBLIC_SENTRY_DSN) {
  try {
    Sentry.init({
      dsn: clientEnv.NEXT_PUBLIC_SENTRY_DSN,
      environment: clientEnv.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? serverEnv.NODE_ENV,
      tracesSampleRate: clientEnv.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE,
      // ponytail: GlitchTip doesn't support Sentry session envelopes. v10
      // sessions are opt-in via integrations; default is off.
      release: clientEnv.NEXT_PUBLIC_SENTRY_RELEASE,
      dataCollection: NO_PII_DATA_COLLECTION,
      beforeSend: scrubEvent,
    });
    const dsnHost = new URL(clientEnv.NEXT_PUBLIC_SENTRY_DSN).host;
    console.info('[sentry] initialised (server)', {
      dsn_host: dsnHost,
      environment: clientEnv.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? serverEnv.NODE_ENV,
      release: clientEnv.NEXT_PUBLIC_SENTRY_RELEASE,
    });
  } catch (err) {
    console.error('[sentry] init failed (server)', err);
  }
} else {
  console.info('[sentry] disabled (server) — NEXT_PUBLIC_SENTRY_DSN empty');
}
