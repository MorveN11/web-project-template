// Next.js 15+ client-side instrumentation hook. Runs once at app
// startup in the browser. Loaded automatically by Next.js (not by
// Sentry's plugin). This is the modern replacement for
// `sentry.client.config.ts` at project root.
//
// Dev never tracks — single gate on DSN presence. Deployed envs
// (testing / production) inject the DSN via Dokploy build args; dev
// never sets it, so the SDK stays uninitialised.

import * as Sentry from '@sentry/nextjs';
import { env as clientEnv } from '@/lib/env/client';

if (clientEnv.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: clientEnv.NEXT_PUBLIC_SENTRY_DSN,
    environment: clientEnv.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
    tracesSampleRate: clientEnv.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE,
    // Browser events get sent to our own tunnel route instead of the
    // GlitchTip hostname directly — bypasses ad-blockers and avoids
    // leaking the DSN hostname in the browser network tab.
    tunnel: '/api/glitchtip-tunnel',
    release: clientEnv.NEXT_PUBLIC_SENTRY_RELEASE,
  });
}
