// GlitchTip / Sentry initialization. Hard-gated to non-development
// environments — local dev (NODE_ENV=development) MUST NOT track.
// Two layers of disable so a misconfigured DSN in dev still no-ops:
//
//   1. NODE_ENV gate: skip initSentry() entirely when developing.
//   2. DSN-empty gate: skip when SENTRY_DSN is unset.
//
// Setting `SENTRY_DSN` in a dev .env is a no-op — this is enforced at
// runtime, not by convention. The rationale: noise from a laptop
// running on flaky Wi-Fi drowns out the real errors from the deployed
// environments that actually matter for on-call.
//
// Pattern (per web-project-template): every fork wires this in by
// default. Env vars all optional. Set `SENTRY_DSN` + deploy — Sentry
// activates; leave it empty in dev — silent no-op.
//
// Call once at boot from `apps/api/src/index.ts` after `attachPrismaLogging()`
// (env parsed → logger ready → prisma hooked → Sentry hooked → app build).
// The unhandled-exception branch of `app.onError` mirrors to Sentry
// so pino + Sentry both see the same crash. Pino still does the
// structured log; Sentry does the aggregation.

import * as Sentry from '@sentry/node';
import { env } from './env';
import { logger } from './logger';

const SERVICE_NAME = 'web-project-template-api';
const APP_NAME = 'web-project-template';

// Headers stripped from every event before it leaves the process —
// GlitchTip never needs raw auth material to be useful.
const REDACTED_HEADERS = new Set(['authorization', 'cookie', 'x-api-key']);

/**
 * Strips request body, cookies, sensitive headers and IP from an
 * event/transaction before it's sent. `dataCollection` already
 * keeps most of this out, but request data can still carry it when an
 * integration captures it explicitly — belt and suspenders.
 */
function scrubEvent<T extends Sentry.Event>(event: T): T {
  const request = event.request;
  if (request) {
    delete request.data;
    delete request.cookies;
    if (request.headers) {
      for (const key of Object.keys(request.headers)) {
        if (REDACTED_HEADERS.has(key.toLowerCase())) delete request.headers[key];
      }
    }
  }
  if (event.user) delete event.user.ip_address;
  return event;
}

let initialised = false;

/**
 * Initialize the Sentry SDK. Safe to call once at boot. Disabled when:
 *   - already initialised (idempotent)
 *   - NODE_ENV === 'development' (no local tracking — enforced)
 *   - SENTRY_DSN is empty (no aggregator configured)
 *
 * Stacking both gates means dev cannot leak events even if a stray
 * SENTRY_DSN is in the local `.env` (a common copy-paste mistake
 * when provisioning the testing env).
 */
export function initSentry(): void {
  if (initialised) return;

  // Development gate — must run before the DSN check. Local dev
  // should never send events, even if SENTRY_DSN leaks from a
  // testing config copy. NODE_ENV is inlined at process start, so
  // this can't be flipped post-boot.
  if (env.NODE_ENV === 'development') {
    logger.info({ reason: 'dev-never-tracks', node_env: env.NODE_ENV }, 'sentry: disabled (NODE_ENV=development)');
    return;
  }

  if (!env.SENTRY_DSN) {
    logger.warn(
      { reason: 'dsn-empty', node_env: env.NODE_ENV },
      'sentry: disabled (SENTRY_DSN is empty — set it in Dokploy env for this service)',
    );
    return;
  }

  let dsnHost: string;
  try {
    dsnHost = new URL(env.SENTRY_DSN).host;
  } catch {
    logger.warn({ reason: 'dsn-malformed' }, 'sentry: SENTRY_DSN is not a valid URL — skipping init');
    return;
  }

  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT,
    tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE,
    // Bake the release name into events. CI/release workflows can
    // override this with a sha tag (set SENTRY_RELEASE in env) so the
    // GlitchTip UI can link errors to deploys.
    release: env.SENTRY_RELEASE,
    // pino is not wired into Sentry: we mirror errors at the call site in
    // `onError`, so logs are not forwarded. Forks that want Sentry logs
    // add `Sentry.pinoIntegration()` on top.
    //
    // Don't let the SDK auto-attach PII (user info, cookies, headers,
    // bodies, query params, DB data) — `scrubEvent` below is the last
    // line of defence before an event leaves the process.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      databaseQueryData: false,
    },
    integrations: [Sentry.httpIntegration({ maxRequestBodySize: 'none' })],
    beforeSend: scrubEvent,
  });

  Sentry.setTags({
    service: SERVICE_NAME,
    app: APP_NAME,
    node_env: env.NODE_ENV,
  });

  initialised = true;
  logger.info(
    {
      dsn_host: dsnHost,
      environment: env.SENTRY_ENVIRONMENT,
      tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE,
      release: env.SENTRY_RELEASE,
    },
    'sentry: initialised',
  );

  if (env.SENTRY_RELEASE === '') {
    // No release tag → events can't be linked to a deploy.
    // Surface it so the next deploy can be diagnosed; not a hard error
    // (boots still work, events still flow — just without a release tag).
    logger.warn(
      { reason: 'release-empty' },
      'sentry: SENTRY_RELEASE is empty — events will not be tagged with a release',
    );
  }
}

/**
 * True iff `initSentry()` has actually wired the SDK. Use to guard
 * `captureException` calls so we don't issue SDK calls when the
 * aggregator is absent (saves one unnecessary function-pointer
 * dispatch per error path).
 */
export function isSentryEnabled(): boolean {
  return initialised;
}

// Re-export so call sites can `import { Sentry } from '@/sentry'` and
// the SDK handle lives in one place. Tree-shaking is fine because
// Sentry is a single named namespace.
export { Sentry };
