// Clerk BAPI user memo — L1 (in-process Map) + L2 (Redis).
//
// `clerkClient.users.getUser(sub)` is the per-request Clerk read that
// powers `requireAuth`. Caching it briefly:
//
//   1. Cuts Clerk BAPI quota usage — `/app/admin` previously did 6
//      BAPI reads per render; the web's `cache()` fix brings that to
//      1, and this memo means subsequent renders within the TTL hit
//      L1 (or L2 across api instances).
//   2. Survives api horizontal scaling — L1 is per-process, L2 is
//      shared via Redis. With a single api container, L1 alone would
//      suffice; L2 is here so a future scale-out doesn't re-fetch
//      from Clerk on every cold replica.
//
// Trade-off: `privateMetadata.role` flips in Clerk propagate within
// the TTL window (30s). `invalidateClerkUserCached(sub)` short-
// circuits the TTL — call it after mutating role.

import { createClerkClient, type User } from '@clerk/backend';
import { env } from '../env';
import { logger } from '../logger';
import { redisDel, redisGet, redisSet } from './redis';

const CLERK_USER_TTL_MS = 30_000;
const CLERK_USER_TTL_SECONDS = Math.ceil(CLERK_USER_TTL_MS / 1000);
const CLERK_USER_CACHE_MAX = 1000;

interface ClerkUserEntry {
  user: User;
  expiresAt: number;
}

const clerkClient = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });

// L1 — per-process Map. FIFO eviction at capacity.
const l1 = new Map<string, ClerkUserEntry>();

function l1Get(sub: string): User | null {
  const entry = l1.get(sub);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    l1.delete(sub);
    return null;
  }
  return entry.user;
}

function l1Set(sub: string, user: User): void {
  if (l1.size >= CLERK_USER_CACHE_MAX) {
    const oldest = l1.keys().next().value;
    if (oldest !== undefined) l1.delete(oldest);
  }
  l1.set(sub, { user, expiresAt: Date.now() + CLERK_USER_TTL_MS });
}

function l1Del(sub: string): void {
  l1.delete(sub);
}

// L2 key. Versioned so a future schema change can drop the whole
// namespace with one `DEL clerk:user:v1:*`. The ioredis client
// already prepends `${REDIS_KEY_PREFIX}${NODE_ENV}-`, so the env
// isolation is handled at the client layer — no per-key prefix here.
// Clerk user IDs are only globally unique within a single Clerk
// instance, not across instances.
const L2_KEY = (sub: string) => `clerk:user:v1:${sub}`;

/**
 * Cached Clerk BAPI fetch. Lookup order: L1 → L2 → Clerk. Writes
 * populate both layers. Failures don't poison the cache.
 */
export async function getClerkUserCached(sub: string): Promise<User> {
  // L1 fast path
  const l1Hit = l1Get(sub);
  if (l1Hit) {
    logger.debug({ sub, source: 'mem' }, 'cache hit');
    return l1Hit;
  }

  // L2 (Redis)
  const l2Hit = await redisGet(L2_KEY(sub));
  if (l2Hit) {
    try {
      const user = JSON.parse(l2Hit) as User;
      l1Set(sub, user);
      logger.debug({ sub, source: 'redis' }, 'cache hit');
      return user;
    } catch (cause) {
      // Corrupt entry — drop and continue to BAPI.
      logger.warn({ sub, cause }, 'cache: corrupt redis entry, refetching');
      await redisDel(L2_KEY(sub));
    }
  }

  // L3 — Clerk BAPI
  const user = await clerkClient.users.getUser(sub);
  l1Set(sub, user);
  // Fire-and-forget L2 write; failure is logged inside redisSet.
  await redisSet(L2_KEY(sub), JSON.stringify(user), CLERK_USER_TTL_SECONDS);
  logger.debug({ sub, source: 'clerk' }, 'cache miss, primed');
  return user;
}

/**
 * Drop the cached entry for `sub` from both layers. Call after
 * mutating `privateMetadata.role` so the next request re-reads
 * from Clerk instead of serving the stale role for up to TTL.
 */
export async function invalidateClerkUserCached(sub: string): Promise<void> {
  l1Del(sub);
  await redisDel(L2_KEY(sub));
}

// Re-export the clerk client so `auth/clerk.ts` can verify JWTs
// without spinning up its own client.
export { clerkClient };
