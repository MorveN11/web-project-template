// Health endpoint. Public (no auth). Returns process info + DB
// reachability. DB failure never throws — only flips `status` to
// `degraded` so a docker healthcheck can still get a 200 with a
// degraded flag.

import { database } from '@app/db';
import { Hono } from 'hono';
import { logger } from '../logger';

export const healthRoutes = new Hono().get('/', async (c) => {
  let db: 'ok' | 'down' = 'ok';
  try {
    await database.$queryRaw`SELECT 1`;
  } catch (cause) {
    logger.error({ cause }, 'health: db unreachable');
    db = 'down';
  }
  return c.json({
    status: db === 'ok' ? 'ok' : 'degraded',
    service: 'api',
    uptime_seconds: Math.round(process.uptime()),
    database: db,
    timestamp: new Date().toISOString(),
  });
});
