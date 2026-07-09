// Wire Prisma's internal events into our pino logger. Queries are opt-in
// via LOG_QUERIES=true so prod logs stay request-scoped. Errors and
// warnings always go through.

import { Prisma } from '@app/db';
import { env } from '../env';
import { logger } from '../logger';

export function attachPrismaLogging() {
  Prisma.addHook('query', (event) => {
    if (!env.LOG_QUERIES) return;
    logger.debug(
      {
        query: event.query,
        params: event.params,
        duration_ms: event.duration,
      },
      'prisma query',
    );
  });

  Prisma.addHook('warn', (event) => {
    logger.warn({ event }, 'prisma warn');
  });

  Prisma.addHook('error', (event) => {
    logger.error({ event: event.message, query: event.query }, 'prisma error');
  });
}
