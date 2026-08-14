// Next.js 13+ instrumentation hook. Runs once at boot on the server
// (NOT in the browser). Loads the right Sentry SDK config for the
// current runtime so middleware errors (edge) and route errors (node)
// both flow to GlitchTip.
//
// The client config is in `instrumentation-client.ts` (loaded by
// Next.js directly). The server + edge configs are auto-loaded by
// `@sentry/nextjs`'s build-time plugin.

import * as Sentry from '@sentry/nextjs';

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config');
  }
}

// Captures server-side request errors that bubble out of route
// handlers + middleware. Next.js calls this for every unhandled error
// in the request lifecycle. Wired by the Sentry SDK.
export const onRequestError = Sentry.captureRequestError;
