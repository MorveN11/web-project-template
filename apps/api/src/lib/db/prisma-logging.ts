// Wire Prisma's internal events into our pino logger. Queries are opt-in
// via LOG_QUERIES=true so prod logs stay request-scoped. Errors and
// warnings always go through.

import { database, type Prisma } from '@app/db';
import { env } from '../../env';
import { logger } from '../../logger';

export function attachPrismaLogging() {
  database.$on('query', (event: Prisma.QueryEvent) => {
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

  database.$on('warn', (event: Prisma.LogEvent) => {
    logger.warn({ event }, 'prisma warn');
  });

  database.$on('error', (event: Prisma.LogEvent) => {
    logger.error({ event: event.message }, 'prisma error');
  });
}
