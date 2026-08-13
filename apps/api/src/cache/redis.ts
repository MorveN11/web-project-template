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
//
// Key namespacing: every fork MUST set `keyPrefix: '<app-name>-<env>-'`
// so Redis keys can't collide when (a) multiple forks share a cluster
// OR (b) multiple environments (dev/staging/prod) of one fork point at
// the same Redis. The prefix is computed at client-construct time
// as `${REDIS_KEY_PREFIX}${env.NODE_ENV}-`:
//   - REDIS_KEY_PREFIX defaults to the app name (`web-project-template-`).
//   - NODE_ENV is required (validated by env.ts) — the resulting
//     keys look like `web-project-template-development-user:session:v1:<id>`
//     locally and `web-project-template-production-user:session:v1:<id>`
//     in prod.
// The helpers (`redisGet` / `Set` / `Del`) take unprefixed keys;
// ioredis prepends the joined prefix transparently.

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
      // Per-app + per-env namespace. See file header — required
      // convention for every fork. Joins REDIS_KEY_PREFIX +
      // NODE_ENV so dev/staging/prod never share keys even when
      // they point at the same Redis cluster.
      keyPrefix: `${env.REDIS_KEY_PREFIX}${env.NODE_ENV}-`,
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
 * Set a key with TTL (seconds). `set` returns `null` on success
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