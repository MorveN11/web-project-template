// UserSession DTO cache — Redis only (no L1).
//
// Why no L1: the DTO is per-user global state. Sharing it across
// api instances is the whole point of the cache — an in-process L1
// would re-introduce the divergence problem when api scales out.
// The BAPI cache (`clerk-user.ts`) keeps L1 because Clerk's API
// response is read-mostly at the per-instance level; the DTO here
// is read-mostly at the cluster level.
//
// Plug point: `features/users/service.ts syncSelf` checks this
// before hitting the DB. Webhooks invalidate on `user.updated` /
// `user.deleted` so external edits propagate within milliseconds
// instead of waiting out the 30s TTL.

import { env } from '../env';
import type { UserDto } from '../features/users/mappers';
import { logger } from '../logger';
import { redisDel, redisGet, redisSet } from './redis';

const USER_SESSION_TTL_SECONDS = 30;
// Versioned key prefix — bump on schema change to drop the whole
// namespace in one Redis `DEL`. Environment prefix (`prod:` / `dev:`)
// keeps dev/staging/prod from colliding on a shared Redis instance.
const L2_KEY = (clerkId: string) => `${env.NODE_ENV === 'production' ? 'prod' : 'dev'}:user:session:v1:${clerkId}`;

/**
 * Fetch the cached DTO. Returns `null` on miss OR on Redis error —
 * the caller falls through to the DB either way.
 */
export async function getUserSessionCached(clerkId: string): Promise<UserDto | null> {
  const raw = await redisGet(L2_KEY(clerkId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserDto;
  } catch (cause) {
    logger.warn({ clerkId, cause }, 'cache: corrupt user-session entry, refetching');
    await redisDel(L2_KEY(clerkId));
    return null;
  }
}

/**
 * Prime the cache after a DB read or write. Best-effort: if Redis
 * is down the write is silently dropped, the next request just
 * re-reads from the DB.
 */
export async function setUserSessionCached(clerkId: string, dto: UserDto): Promise<void> {
  await redisSet(L2_KEY(clerkId), JSON.stringify(dto), USER_SESSION_TTL_SECONDS);
}

/**
 * Drop the cache entry. Call from any code path that mutates the
 * local `User` row (webhooks, admin endpoints, BAPI role writes).
 */
export async function invalidateUserSessionCached(clerkId: string): Promise<void> {
  await redisDel(L2_KEY(clerkId));
}
