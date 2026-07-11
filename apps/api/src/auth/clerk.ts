// Clerk JWT verification via the official `@clerk/backend` SDK. Replaces
// a hand-rolled jose path: Clerk resolves the issuer/audience from
// `secretKey` automatically, fetches JWKS from the right place, and
// keeps the verification primitives in sync with the rest of the
// Clerk ecosystem. Middleware still throws on failure (Hono's
// onError maps HttpError to the wire envelope) and downstream handlers
// read the typed context with `getAuth(c)`.

import { UserRole, type UserRole as UserRoleType } from '@app/shared-types';
import { verifyToken } from '@clerk/backend';
import type { Context, MiddlewareHandler } from 'hono';
import { env } from '../env';
import { logger, withRequest } from '../logger';

export interface ClerkAuthContext {
  userId: string;
  sessionId: string;
  token: string;
  role: UserRoleType | null;
  claims: NonNullable<Awaited<ReturnType<typeof verifyToken>>>;
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
  try {
    // `authorizedParties` only applies to JWTs minted by the Clerk
    // frontend SDK — those carry an `azp` claim matching the
    // origin that requested them. Tokens minted server-side via the
    // BAPI (e.g. our /dev/issue-token endpoint, or any other
    // machine-to-machine flow) have NO `azp`, and passing
    // `authorizedParties` would reject them.
    //
    // Strategy: do the signature + exp + iss check unconditionally;
    // only add `authorizedParties` when the token actually carries
    // an `azp` claim. That way both flows work without weakening
    // either — frontend tokens are still pinned to known origins,
    // BAPI tokens pass through.
    const claims = await verifyToken(token, {
      secretKey: env.CLERK_SECRET_KEY,
      ...(hasAzp(token) && { authorizedParties: AUTHORIZED_PARTIES }),
    });
    if (!claims.sub) {
      throw new HttpError(401, 'unauthorized', 'missing sub claim');
    }
    // Role comes from the JWT template claim first (set by Clerk's
    // session-token customization), with a fallback to the raw
    // `publicMetadata` field for tokens minted before the template
    // existed. The local-DB user id is the `userId` template claim;
    // the Clerk user id is the standard `sub`.
    const c = claims as {
      role?: unknown;
      userId?: unknown;
    };
    const rawRole = c.role;
    const role: UserRoleType | null = rawRole === UserRole.ADMIN || rawRole === UserRole.CLIENT ? rawRole : null;
    return {
      userId: claims.sub,
      // Clerk uses `sid` for session id. The SDK types it loosely;
      // coerce to string for our typed context shape.
      sessionId: typeof claims.sid === 'string' ? claims.sid : '',
      token,
      role,
      claims,
    };
  } catch (cause) {
    if (cause instanceof HttpError) throw cause;
    logger.debug({ cause }, 'clerk token verification failed');
    throw new HttpError(401, 'unauthorized', 'invalid or expired token');
  }
}

/**
 * Cheap pre-check: does this JWT carry an `azp` claim?
 *
 * Implemented by decoding the payload (middle segment) without
 * verifying the signature — we only need to know the claim exists
 * so we can decide whether to pass `authorizedParties`. The actual
 * signature verification happens inside `verifyToken`.
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
    throw new HttpError(401, 'unauthorized', 'missing bearer token');
  }
  const token = header.slice('Bearer '.length).trim();
  const ctx = await verifyClerkToken(token);
  c.set('auth', ctx);
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
// parent app's `request_id` middleware didn't reach. Single source of
// truth — wired once at the app root in `src/index.ts` so every route
// inherits it without per-feature duplication.
export const attachUserLogger: MiddlewareHandler = async (c, next) => {
  try {
    const auth = getAuth(c);
    const log = c.get('log') as ReturnType<typeof withRequest>;
    c.set('log', log.child({ user_id: auth.userId } as Record<string, unknown>) as ReturnType<typeof withRequest>);
  } catch {
    /* public path — no auth context */
  }
  if (!c.get('log')) c.set('log', withRequest(c.get('request_id')));
  await next();
};
