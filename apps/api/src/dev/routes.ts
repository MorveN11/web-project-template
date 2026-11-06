// Dev-only helpers. Mounted by `src/index.ts` ONLY when
// `env.NODE_ENV !== 'production'`. Never reachable in prod — the
// gate in index.ts keeps the route from registering entirely.
//
// `POST /dev/issue-token` mints a Clerk session JWT for an
// arbitrary user (identified by **email** for dev convenience), with
// a caller-controlled lifetime (default 1 day, max 30 days). The
// Scalar UI bridge script consumes this to offer a one-click
// "Sign in as Clerk user" flow so devs never have to copy/paste
// JWTs from the web app's cookie panel.
//
// ⚠️ Production safety: this route must NEVER mount under production.
//   - `index.ts` gates the mount on NODE_ENV
//   - The handler also re-checks `env.NODE_ENV !== 'production'` as
//     defense in depth, in case future refactors break the gate.

import { database } from '@app/db';
import { createClerkClient } from '@clerk/backend';
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { env } from '@/env';
import { UserRepository } from '@/features/users/repository';
import { publicSecurity } from '@/lib/openapi/security';
import { logger } from '@/logger';

const clerk = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });

const MAX_DURATION_SECONDS = 60 * 60 * 24 * 30; // 30 days
const DEFAULT_DURATION_SECONDS = 60 * 60 * 24; // 1 day

const issueTokenRoute = createRoute({
  method: 'post',
  path: '/issue-token',
  security: publicSecurity,
  summary: 'Mint a Clerk session token for a user (dev only)',
  description:
    'Dev helper. Looks up a Clerk user by email, creates a fresh ' +
    'session, and returns a JWT with the requested lifetime. ' +
    'Mounted only when `NODE_ENV !== "production"`.',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            email: z.string().email(),
            durationSeconds: z
              .number()
              .int()
              .min(60) // 1 minute
              .max(MAX_DURATION_SECONDS)
              .default(DEFAULT_DURATION_SECONDS),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'text/plain': {
          schema: z.string().openapi('ClerkSessionJwt'),
        },
      },
      description: 'session JWT — raw text body, ready to paste into Authorization: Bearer …',
    },
    404: { description: 'no Clerk user with that email' },
  },
});

export const devRoutes = new OpenAPIHono().openapi(issueTokenRoute, async (c) => {
  // Defense-in-depth guard. The index.ts mount gate should already
  // prevent this route from registering in prod, but if a refactor
  // ever drops that gate, this throws before any BAPI call.
  if (env.NODE_ENV === 'production') {
    throw new Error('dev routes must never mount in production');
  }

  const { email, durationSeconds } = c.req.valid('json');
  const userRepo = new UserRepository(database);

  try {
    // Look the user up by email via Clerk BAPI. `getUserList` does a
    // partial-match substring search; for an exact email filter we
    // pass it through `emailAddress` (Clerk does case-insensitive
    // exact match on the array form).
    const list = await clerk.users.getUserList({ emailAddress: [email] });
    const clerkUser = list.data[0];

    if (!clerkUser) {
      return c.json({ error: { code: 'not_found', message: `no Clerk user with email ${email}` } }, 404);
    }

    // Sanity check — confirm the local mirror exists. If not, the
    // /users/me sync hasn't run yet for this user.
    const localRow = await userRepo.findByClerkId(clerkUser.id);
    if (!localRow) {
      logger.warn(
        { email, clerkId: clerkUser.id },
        'dev: clerk user has no local mirror — minting token anyway, /users/me will sync on first request',
      );
    }

    // Create a fresh session, then mint a JWT for that session with
    // the caller-controlled lifetime. Clerk stores the session; it
    // expires automatically at `expireAt`.
    const session = await clerk.sessions.createSession({ userId: clerkUser.id });
    const { jwt } = await clerk.sessions.getToken(session.id, undefined, durationSeconds);

    const expiresAt = Math.floor(Date.now() / 1000) + durationSeconds;
    logger.info({ email, clerkId: clerkUser.id, sessionId: session.id, expiresAt }, 'dev: issued session token');

    // Return the JWT as raw text/plain — devs `$(curl ...)` it
    // straight into Authorization headers without parsing JSON.
    return c.text(jwt, 200, { 'Content-Type': 'text/plain; charset=utf-8' });
  } catch (cause) {
    logger.error({ cause, email }, 'dev: issue-token failed');
    return c.json({ error: { code: 'internal_error', message: 'failed to mint token' } }, 500);
  }
});
