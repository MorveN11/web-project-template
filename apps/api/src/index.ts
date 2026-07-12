// Hono boot. Order: env (already parsed at import time) → logger →
// request-id middleware → CORS → public mounts → auth gate →
// v1 mounts → 404 + error handler → graceful shutdown.

import { randomUUID } from 'node:crypto';
import { serve } from '@hono/node-server';
import { OpenAPIHono } from '@hono/zod-openapi';
import { Scalar } from '@scalar/hono-api-reference';
import { cors } from 'hono/cors';
import { attachUserLogger } from './auth/clerk';
import { attachPrismaLogging } from './db/prisma-logging';
import { devRoutes } from './dev';
import { env } from './env';
import { healthRoutes } from './features/health';
import { userRoutes } from './features/users';
import { handleClerkWebhook } from './features/webhooks';
import { logger, withRequest } from './logger';
import { bearerSecurity } from './openapi/security';
// Side-effect import: registers Hono context-variable augmentation
// (`log`, `request_id`). Required for typed `c.set` / `c.get` calls below.
import './types/hono-context';

attachPrismaLogging();

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

app.use(
  '*',
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Authorization', 'Content-Type', 'X-Request-Id'],
  }),
);

// Public endpoints. No auth required.
app.route('/health', healthRoutes);
// Clerk webhook receiver — signature verification is the auth; no
// `requireAuth` / `requireRole` middleware in front of this. Mounted
// before the business routers so the raw-body signature check runs
// before any OpenAPIHono route resolution.
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
  // web app's cookie panel.
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
