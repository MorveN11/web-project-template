// Clerk JWT verification + BAPI-backed auth context.
//
// Flow:
//   1. Verify the bearer token (signature, exp, iss) via `@clerk/backend`.
//   2. Resolve the Clerk user via `getClerkUserCached(sub)` from
//      `cache/clerk-user.ts` — L1 in-process Map + L2 Redis, 30s TTL.
//   3. Source profile fields + `privateMetadata.role` from the user
//      object — never from JWT claims.
//
// Why BAPI for the user object (not just the `sub` from the JWT):
//   - Keeps the JWT template empty of custom claims. The web app
//     cannot tamper with role, email, or name by forging a token —
//     those values come straight from Clerk's user store on every
//     authenticated request.
//   - `privateMetadata` is backend-only by design; the role lives
//     there (not in `publicMetadata`, which the frontend SDK exposes
//     via the session token).
//   - Handlers get a single `clerkUser` object instead of a custom-
//     claims soup, and `service.syncSelf` reuses it without a second
//     BAPI round-trip.
//
// Trade-off: +1 Clerk BAPI read per authenticated request, mitigated
// by the L1+L2 memo in `cache/clerk-user.ts` (30s TTL). Role flips
// in Clerk propagate within the TTL window — call
// `invalidateClerkUserCached(sub)` after mutating role to skip the
// wait.

import { UserRole, type UserRole as UserRoleType } from '@app/shared-types';
import { type User, verifyToken } from '@clerk/backend';
import type { Context, MiddlewareHandler } from 'hono';
import { getClerkUserCached } from '../cache/clerk-user';
import { env } from '../env';
import { logger, withRequest } from '../logger';

export interface ClerkAuthContext {
  clerkUserId: string;
  sessionId: string;
  token: string;
  role: UserRoleType | null;
  email: string;
  firstName: string;
  lastName: string;
  imageUrl: string | null;
  clerkUser: User;
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

const AUTHORIZED_PARTIES = env.CLERK_AUTHORIZED_PARTIES;

export async function verifyClerkToken(token: string): Promise<ClerkAuthContext> {
  // `authorizedParties` only applies to JWTs minted by the Clerk
  // frontend SDK — those carry an `azp` claim matching the origin
  // that requested them. BAPI-minted tokens have no `azp`; passing
  // `authorizedParties` for those would reject them. Only add the
  // check when the token actually carries `azp`.
  let sub: string;
  let sessionId: string;
  try {
    const claims = await verifyToken(token, {
      secretKey: env.CLERK_SECRET_KEY,
      ...(hasAzp(token) && { authorizedParties: AUTHORIZED_PARTIES }),
    });
    if (!claims.sub) throw new HttpError(401, 'unauthorized', 'missing sub claim');
    sub = claims.sub;
    sessionId = typeof claims.sid === 'string' ? claims.sid : '';
  } catch (cause) {
    if (cause instanceof HttpError) throw cause;
    logger.debug({ cause }, 'clerk token verification failed');
    throw new HttpError(401, 'unauthorized', 'invalid or expired token');
  }

  let clerkUser: User;
  try {
    clerkUser = await getClerkUserCached(sub);
  } catch (cause) {
    logger.debug({ cause, sub }, 'clerk user fetch failed');
    throw new HttpError(401, 'unauthorized', 'invalid or expired token');
  }

  const email = clerkUser.emailAddresses[0]?.emailAddress;
  if (!email) {
    logger.debug({ sub }, 'clerk user has no email');
    throw new HttpError(401, 'unauthorized', 'invalid or expired token');
  }

  const meta = (clerkUser.privateMetadata ?? {}) as { role?: unknown };
  const rawRole = meta.role;
  const role: UserRoleType | null = rawRole === UserRole.ADMIN || rawRole === UserRole.CLIENT ? rawRole : null;

  return {
    clerkUserId: sub,
    sessionId,
    token,
    role,
    email,
    firstName: clerkUser.firstName ?? '',
    lastName: clerkUser.lastName ?? '',
    imageUrl: clerkUser.imageUrl ?? null,
    clerkUser,
  };
}

/**
 * Cheap pre-check: does this JWT carry an `azp` claim? Decodes the
 * payload (middle segment) without verifying the signature — we only
 * need to know the claim exists to decide whether to pass
 * `authorizedParties`. Signature verification happens inside `verifyToken`.
 */
function hasAzp(token: string): boolean {
  const segments = token.split('.');
  const payload = segments[1];
  if (!payload) return false;
  try {
    const pad = (s: string) => s + '='.repeat((4 - (s.length % 4)) % 4);
    const json = JSON.parse(
      Buffer.from(pad(payload).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'),
    ) as { azp?: unknown };
    return typeof json.azp === 'string' && json.azp.length > 0;
  } catch {
    return false;
  }
}

export const requireAuth: MiddlewareHandler = async (c, next) => {
  const header = c.req.header('authorization');
  if (!header?.startsWith('Bearer ')) {
    c.get('log')?.warn({ event: 'auth.failed', reason: 'missing_bearer' }, 'auth.failed: missing bearer token');
    throw new HttpError(401, 'unauthorized', 'missing bearer token');
  }
  const token = header.slice('Bearer '.length).trim();
  let ctx: ClerkAuthContext;
  try {
    ctx = await verifyClerkToken(token);
  } catch (cause) {
    // verifyClerkToken only throws 401s; treat them all as failed
    // auth attempts for the audit log. The onError handler turns
    // the throw into the 401 response.
    c.get('log')?.warn({ event: 'auth.failed', reason: 'invalid_token', cause }, 'auth.failed: invalid token');
    throw cause;
  }
  c.set('auth', ctx);
  c.get('log')?.info({ event: 'auth.ok', user_id: ctx.clerkUserId }, 'auth.ok');
  await next();
};

export function getAuth(c: Context): ClerkAuthContext {
  const auth = c.get('auth') as ClerkAuthContext | undefined;
  if (!auth) throw new HttpError(401, 'unauthorized', 'no auth context on request');
  return auth;
}

// Logger-context middleware. Attaches `user_id` to the request-scoped
// pino logger when an auth context is present (silently skips on
// public routes) and re-primes the logger on sub-routers where the
// parent app's `request_id` middleware didn't reach. Single source
// of truth — wired once at the app root in `src/index.ts` so every route
// inherits it without per-feature duplication.
export const attachUserLogger: MiddlewareHandler = async (c, next) => {
  try {
    const auth = getAuth(c);
    const log = c.get('log') as ReturnType<typeof withRequest>;
    c.set('log', log.child({ user_id: auth.clerkUserId } as Record<string, unknown>) as ReturnType<typeof withRequest>);
  } catch {
    /* public path — no auth context */
  }
  if (!c.get('log')) c.set('log', withRequest(c.get('request_id')));
  await next();
};
