// Hono boot. Order: env (already parsed at import time) → logger →
// request-id middleware → CORS → public mounts → auth gate →
// v1 mounts → 404 + error handler → graceful shutdown.

import { randomUUID } from 'node:crypto';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Logger } from 'pino';
import { getAuth, requireAuth } from './auth/clerk';
import { attachPrismaLogging } from './db/prisma-logging';
import { env } from './env';
import { healthRoutes } from './health/routes';
import { itemRoutes } from './items';
import { logger, withRequest } from './logger';
// Side-effect import: registers Hono context-variable augmentation
// (`log`, `request_id`). Required for typed `c.set` / `c.get` calls below.
import './types/hono-context';

attachPrismaLogging();

const app = new Hono();

// request_id: every log line downstream carries this id for tracing.
app.use('*', async (c, next) => {
  const incoming = c.req.header('x-request-id');
  const id = incoming?.slice(0, 128) || randomUUID();
  c.set('request_id', id);
  c.header('x-request-id', id);
  c.set('log', withRequest(id));
  await next();
});

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
app.get('/', (c) =>
  c.json({
    service: 'web-project-template api',
    version: '0.0.0',
    docs: '/health',
  }),
);

// Auth gate for everything below. Inject logger context per route so
// downstream handlers can attach user_id to logs without re-parsing
// the token.
app.use('/v1/*', requireAuth);
app.use('/v1/*', async (c, next) => {
  try {
    const auth = getAuth(c);
    const log = c.get('log') as Logger;
    c.set('log', log.child({ user_id: auth.userId } as Record<string, unknown>) as Logger);
  } catch {
    /* requireAuth already threw — let onError handle it */
  }
  await next();
});

// Versioned, authenticated business endpoints.
app.route('/v1/items', itemRoutes);

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
