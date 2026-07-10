// Health endpoint. Public (no auth). Returns process info + DB
// reachability. DB failure never throws — only flips `status` to
// `degraded` so a docker healthcheck can still get a 200 with a
// degraded flag.

import { database } from '@app/db';
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { logger } from '@/logger';
import { publicSecurity } from '@/openapi/security';

const healthResponseSchema = z
  .object({
    status: z.enum(['ok', 'degraded']),
    service: z.literal('api'),
    uptime_seconds: z.number().int(),
    database: z.enum(['ok', 'down']),
    timestamp: z.string(),
  })
  .openapi('HealthResponse');

const healthRoute = createRoute({
  method: 'get',
  path: '/',
  security: publicSecurity,
  responses: {
    200: {
      content: { 'application/json': { schema: healthResponseSchema } },
      description: 'Service is reachable; DB status reported separately.',
    },
  },
});

export const healthRoutes = new OpenAPIHono().openapi(healthRoute, async (c) => {
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
