// pino logger. Single source for log level + format. Driven entirely by env.
//
// Defaults to `info` so production isn't accidentally chatty. Dev sets
// LOG_LEVEL=debug (or lower) to see request lines + Prisma query timings.
// LOG_QUERIES=true enables Prisma `query` events which include params
// and durations.
//
// Pino's `child()` TypeScript bindings default to `never` in v9+. We
// cast the bindings object to `Record<string, unknown>` so callers
// can pass any key shape — the runtime log payload is what matters.

import type { Logger } from 'pino';
import { pino } from 'pino';
import { env } from './env';

const transport =
  env.NODE_ENV === 'production'
    ? undefined
    : {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'HH:MM:ss.l', ignore: 'pid,hostname' },
      };

export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: 'api' },
  transport,
}) as Logger;

/** A child logger scoped to a single request, with `request_id` already attached. */
export function withRequest(requestId: string): Logger {
  return logger.child({ request_id: requestId }) as Logger;
}
