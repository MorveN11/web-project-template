// Redis client singleton.
//
// Single-node Redis container. Lazy connect on first use, soft-fail
// on outage — the cache layer below must work without Redis (falls
// back to in-process L1). Redis is a perf optimization, not a source
// of truth; Clerk BAPI is.
//
// Driver: `ioredis`. We picked it over `redis` (node-redis) because
// the latter's v6 generics have an unresolvable RESP-version variance
// (`createClient({url})` infers RESP2; the default-typed alias is
// RESP3 — TS rejects every assign-back). ioredis is a concrete class
// with stable types — no generic dance, no `any` escape hatch.

import Redis from 'ioredis';
import { env } from '../env';
import { logger } from '../logger';

let client: Redis | null = null;
let connectPromise: Promise<Redis | null> | null = null;
let healthy = false;

/**
 * Get the shared Redis client. Returns `null` if Redis is unreachable
 * — callers must handle that path (fall back to in-process cache).
 * Idempotent + thread-safe: parallel callers share one connect.
 */
export async function getRedis(): Promise<Redis | null> {
  if (healthy && client) return client;
  if (connectPromise) return connectPromise;

  connectPromise = (async () => {
    const c = new Redis(env.REDIS_URL, {
      // ioredis auto-connects by default; explicitly disable so we
      // control timing (the await lets us fall through to "degraded"
      // state on connection failure instead of letting the error fire
      // on the first command).
      lazyConnect: true,
      // Cap retries so a flaky network doesn't pin the process forever.
      maxRetriesPerRequest: 2,
    });

    c.on('error', (err) => {
      // Soft-fail: log once at warn, flip unhealthy, drop the
      // resolved connectPromise so the next `getRedis()` re-attempts.
      logger.warn({ err }, 'redis: client error');
      healthy = false;
      connectPromise = null;
    });

    try {
      await c.connect();
      client = c;
      healthy = true;
      logger.info({ url: env.REDIS_URL }, 'redis: connected');
      return c;
    } catch (err) {
      logger.warn({ err, url: env.REDIS_URL }, 'redis: connect failed, degrading');
      healthy = false;
      client = null;
      connectPromise = null;
      return null;
    }
  })();

  return connectPromise;
}

/** True iff the last health probe succeeded. Cheap, no I/O. */
export function isRedisHealthy(): boolean {
  return healthy;
}

/**
 * Get a key. Returns `null` on miss OR on Redis error — callers must
 * not distinguish (the fallback is the in-process L1).
 */
export async function redisGet(key: string): Promise<string | null> {
  const c = await getRedis();
  if (!c) return null;
  try {
    return await c.get(key);
  } catch (err) {
    logger.warn({ err, key }, 'redis: get failed');
    healthy = false;
    return null;
  }
}

/**
 * Set a key with TTL (seconds). Returns `false` on Redis error so
 * callers can log without throwing. `set` returns `null` on success
 * in ioredis (vs the OK string in node-redis); we coerce to boolean.
 */
export async function redisSet(key: string, value: string, ttlSeconds: number): Promise<boolean> {
  const c = await getRedis();
  if (!c) return false;
  try {
    // ioredis signature: `set(key, value, 'EX', seconds)`.
    const result = await c.set(key, value, 'EX', ttlSeconds);
    return result === 'OK';
  } catch (err) {
    logger.warn({ err, key }, 'redis: set failed');
    healthy = false;
    return false;
  }
}

/** Delete a key. Returns `false` on Redis error. */
export async function redisDel(key: string): Promise<boolean> {
  const c = await getRedis();
  if (!c) return false;
  try {
    return (await c.del(key)) > 0;
  } catch (err) {
    logger.warn({ err, key }, 'redis: del failed');
    healthy = false;
    return false;
  }
}

/** Best-effort flush — test/dev only. Skipped in production. */
export async function redisFlushAll(): Promise<void> {
  if (env.NODE_ENV === 'production') return;
  const c = await getRedis();
  if (!c) return;
  try {
    await c.flushall();
  } catch (err) {
    logger.warn({ err }, 'redis: flush failed');
  }
}
