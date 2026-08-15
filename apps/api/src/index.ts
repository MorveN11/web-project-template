// Hono boot. Order: env (already parsed at import time) → logger →
// request-id middleware → secureHeaders → CORS → public mounts →
// auth gate → v1 mounts → 404 + error handler → graceful shutdown.

import { randomUUID } from 'node:crypto';
import { serve } from '@hono/node-server';
import { OpenAPIHono } from '@hono/zod-openapi';
import { Scalar } from '@scalar/hono-api-reference';
import { bodyLimit } from 'hono/body-limit';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { timing } from 'hono/timing';
import { attachUserLogger } from './auth/clerk';
import { attachPrismaLogging } from './db/prisma-logging';
import { devRoutes } from './dev';
import { env } from './env';
import { healthRoutes } from './features/health';
import { userRoutes } from './features/users';
import { handleClerkWebhook } from './features/webhooks';
import { logger, withRequest } from './logger';
import { bearerSecurity } from './openapi/security';
import { webhookAndDevRateLimiter } from './rate-limit';
import { initSentry, isSentryEnabled, Sentry } from './sentry';
// Side-effect import: registers Hono context-variable augmentation
// (`log`, `request_id`). Required for typed `c.set` / `c.get` calls below.
import './types/hono-context';

attachPrismaLogging();
initSentry();

const app = new OpenAPIHono();

// Register the bearer security scheme before any middleware runs.
// The registry is independent of route registration order — the
// component shows up in the generated doc regardless of when routes
// mount. Doing this before `app.use(...)` keeps the type narrowed to
// `OpenAPIHono`, so `app.openAPIRegistry` resolves without a cast.
app.openAPIRegistry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
});

// request_id: every log line downstream carries this id for tracing.
app.use('*', async (c, next) => {
  const incoming = c.req.header('x-request-id');
  const id = incoming?.slice(0, 128) || randomUUID();
  c.set('request_id', id);
  c.header('x-request-id', id);
  c.set('log', withRequest(id));
  await next();
});

// attachUserLogger: enriches the request-scoped logger with `user_id`
// when an auth context is present (silent skip on public routes).
// Mounted at the app root so every feature router inherits it without
// per-feature `.use(...)` duplication.
app.use('*', attachUserLogger);

// Custom access log. Replaces hono/logger so we own the format and
// emit via pino (no second logger).
app.use('*', async (c, next) => {
  const log = c.get('log') as ReturnType<typeof withRequest>;
  const start = performance.now();
  await next();
  const ms = Math.round(performance.now() - start);
  log.info(
    {
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      ms,
    },
    'request',
  );
});

// Secure headers (HSTS, X-Content-Type-Options, etc). Mounted BEFORE
// CORS so the response headers are present even on preflight rejections.
// HSTS only fires when the request came over HTTPS — Hono checks the
// protocol; in dev (http) the header is skipped.
//
// CSP is dev/permissive in non-production to accommodate the Scalar
// API docs UI, which pulls its JS bundle from `cdn.jsdelivr.net`, fonts
// from `fonts.scalar.com`, and connects back to `api.scalar.com`. In
// production none of these endpoints are reachable (the `/docs` and
// `/openapi.json` routes are gated on NODE_ENV above) so the
// allowlists collapse to `'self'` only.
const isProd = env.NODE_ENV === 'production';
app.use(
  '*',
  secureHeaders({
    strictTransportSecurity: isProd ? 'max-age=63072000; includeSubDomains; preload' : false,
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      scriptSrc: isProd ? ["'self'"] : ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https://cdn.jsdelivr.net'],
      scriptSrcElem: isProd ? ["'self'"] : ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https://cdn.jsdelivr.net'],
      imgSrc: isProd ? ["'self'", 'data:', 'blob:'] : ["'self'", 'data:', 'blob:', 'https://cdn.jsdelivr.net'],
      styleSrc: isProd ? ["'self'", "'unsafe-inline'"] : ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
      fontSrc: isProd ? ["'self'"] : ["'self'", 'data:', 'https://fonts.scalar.com'],
      connectSrc: isProd ? ["'self'"] : ["'self'", 'https://cdn.jsdelivr.net', 'https://api.scalar.com'],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
    referrerPolicy: 'strict-origin-when-cross-origin',
    crossOriginOpenerPolicy: 'same-origin',
    crossOriginResourcePolicy: 'same-origin',
    xFrameOptions: 'DENY',
    xContentTypeOptions: 'nosniff',
    permissionsPolicy: {
      camera: [],
      microphone: [],
      geolocation: [],
      payment: [],
      usb: [],
    },
  }),
);

// Server-Timing header on every response (the access log line above
// already includes the same data; the header is for browser dev-tools
// and any external probe that doesn't parse JSON logs).
app.use('*', timing());

// CORS — runs after secureHeaders so preflight rejections still carry
// the security headers.
app.use(
  '*',
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Authorization', 'Content-Type', 'X-Request-Id'],
  }),
);

// Body size limit. 100 KB is enough for every business endpoint in
// this template; webhooks are exempt (mounted before this app.use in
// the route-level guards below, with their own larger ceiling).
// Stops a 100 MB upload from blocking the event loop on the slow path.
app.use('*', bodyLimit({ maxSize: 100 * 1024 }));

// Public endpoints. No auth required.
app.route('/health', healthRoutes);
// Clerk webhook receiver — signature verification is the auth; no
// `requireAuth` / `requireRole` middleware in front of this. Mounted
// before the business routers so the raw-body signature check runs
// before any OpenAPIHono route resolution. Rate-limited to keep a
// flood of bogus signatures from burning CPU.
app.use('/webhooks/clerk', webhookAndDevRateLimiter);
app.post('/webhooks/clerk', (c) => handleClerkWebhook(c.req.raw));
app.get('/', (c) =>
  c.json({
    service: 'web-project-template api',
    version: '0.0.0',
    docs: env.NODE_ENV === 'production' ? null : '/docs',
    openapi: env.NODE_ENV === 'production' ? null : '/openapi.json',
  }),
);

// OpenAPI 3.1 doc + Scalar UI. Bearer scheme so the Try-It-Out box
// accepts a Clerk JWT and forwards it as `Authorization: Bearer …`.
// Gated on NODE_ENV so prod builds expose neither endpoint — keeps
// the surface area lean and avoids leaking internal route shapes.
if (env.NODE_ENV !== 'production') {
  app.doc('/openapi.json', {
    openapi: '3.1.0',
    info: { title: 'web-project-template api', version: '0.0.0' },
    security: bearerSecurity,
  });

  app.get(
    '/docs',
    Scalar({
      url: '/openapi.json',
      authentication: { preferredSecurityScheme: 'bearerAuth' },
      pageTitle: 'API Docs',
      // Persist the Bearer token across page reloads — devs usually
      // hit Try-It-Out many times before the JWT expires.
      persistAuth: true,
    }),
  );

  // Dev-only token-minting endpoint. NEVER mounted in production
  // (the outer if-gate above is the only barrier — the handler also
  // re-checks NODE_ENV as defense in depth). Callers mint a Clerk
  // session JWT by email for testing without copy/pasting from the
  // web app's cookie panel. Same rate-limit budget as the webhook so
  // dev sessions can't accidentally hammer the api.
  app.use('/dev/*', webhookAndDevRateLimiter);
  app.route('/dev', devRoutes);
}

// Business endpoints. No version prefix — each feature router owns its
// own auth gate. Adding /v2 later means a per-router flag, not a
// global prefix migration.
app.route('/users', userRoutes);

app.notFound((c) => c.json({ error: { code: 'not_found', message: 'no route' } }, 404));

app.onError((err, c) => {
  const log = c.get('log') as ReturnType<typeof withRequest> | undefined;
  // Auth middleware throws { status, code, message } typed errors.
  if ('status' in err && 'code' in err) {
    const e = err as { status: number; code: string; message: string };
    log?.warn({ status: e.status, code: e.code, message: e.message }, 'http error');
    return c.json({ error: { code: e.code, message: e.message } }, e.status as 400);
  }
  log?.error({ err }, 'unhandled error');
  // Mirror to Sentry so the aggregator sees unhandled 5xx. Skipped
  // when Sentry is not configured (DSN empty / init no-op). 4xx
  // (typed HttpError) intentionally does NOT reach here — that's
  // client noise, not a server bug.
  if (isSentryEnabled()) {
    Sentry.captureException(err, {
      extra: {
        request_id: c.get('request_id'),
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
      },
    });
  }
  return c.json({ error: { code: 'internal_error', message: 'something exploded' } }, 500);
});

const shutdown = async (signal: string) => {
  logger.info({ signal }, 'shutting down');
  process.exit(0);
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  logger.info({ port: info.port }, 'api listening');
});
