// Next.js 15+ client-side instrumentation hook. Runs once at app
/** biome-ignore-all lint/suspicious/noConsole: 'Sentry Logs' */
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
  try {
    Sentry.init({
      dsn: clientEnv.NEXT_PUBLIC_SENTRY_DSN,
      environment: clientEnv.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
      tracesSampleRate: clientEnv.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE,
      // `tunnel` is injected by `withSentryConfig`'s `tunnelRoute` option
      // at build time — no need to set it manually here.
      release: clientEnv.NEXT_PUBLIC_SENTRY_RELEASE,
    });
    const dsnHost = new URL(clientEnv.NEXT_PUBLIC_SENTRY_DSN).host;
    console.info('[sentry] initialised (browser)', {
      dsn_host: dsnHost,
      environment: clientEnv.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
      release: clientEnv.NEXT_PUBLIC_SENTRY_RELEASE,
      tunnel: '/api/glitchtip-tunnel',
    });
    // Boot heartbeat — proves init → tunnel → GlitchTip pipeline works.
    // Filter by message text in GlitchTip UI. Remove after confirmation.
    Sentry.captureMessage('sentry-boot-probe (browser)', {
      level: 'info',
      tags: { probe: 'boot' },
    });
  } catch (err) {
    console.error('[sentry] init failed', err);
  }
} else {
  console.info('[sentry] disabled (NEXT_PUBLIC_SENTRY_DSN empty — expected in dev)');
}

// Required by @sentry/nextjs v10 to instrument App Router navigations.
// Without this the SDK logs a warning at boot AND skips navigation
// breadcrumbs/transactions.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
