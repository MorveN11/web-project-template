// Clerk JWT verification. Middleware throws (Hono expects throws via
// onError). Downstream handlers read the typed context with `getAuth(c)`.

import type { Context, MiddlewareHandler } from 'hono';
import { createRemoteJWKSet, type JWTPayload, jwtVerify } from 'jose';
import { env } from '../env';
import { logger } from '../logger';

export interface ClerkAuthContext {
  userId: string;
  sessionId: string;
  token: string;
  claims: JWTPayload;
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

const JWKS = createRemoteJWKSet(new URL('https://clerk.example/.well-known/jwks.json'));

export async function verifyClerkToken(token: string): Promise<ClerkAuthContext> {
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: 'https://clerk.example',
      audience: env.CLERK_PUBLISHABLE_KEY,
    });
    if (!payload.sub || !payload.sid) {
      throw new HttpError(401, 'unauthorized', 'missing sub/sid claim');
    }
    return {
      userId: payload.sub,
      // jose's JWTPayload types `sid` loosely (often as `{}`) until we coerce.
      sessionId: String(payload.sid),
      token,
      claims: payload,
    };
  } catch (cause) {
    if (cause instanceof HttpError) throw cause;
    logger.debug({ cause }, 'clerk token verification failed');
    throw new HttpError(401, 'unauthorized', 'invalid or expired token');
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
