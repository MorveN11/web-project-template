'use server';

// Server-only entry points for the auth feature.
//
// This file is the boundary between Clerk's server SDK and the rest
// of the Next.js app. Two exports, both backed by a zero-arg memoized
// core so a single render reads the session/token at most once.
//
//   getCurrentSession({ redirectIfNotFound }) → UserSession | null
//     Reads the Clerk session and returns the local user row. The
//     api reconciles the row on every call, so no caller-side sync
//     dance is needed. When `redirectIfNotFound: true`, missing
//     sessions redirect to the Clerk sign-in URL instead of
//     returning null.
//
//   getCurrentToken({ redirectIfNotFound }) → string | null
//     The current Clerk session JWT, for callers that need to call
//     the api directly (e.g. server actions outside this feature).
//
// All api calls live in `services/auth.service.ts` — this file
// only orchestrates Clerk auth + redirects.
//
// Cache pattern: `cache()` keys on argument identity, so the
// memoized core takes ZERO args. Wrapping the redirect logic in a
// thin outer function would defeat the memo (every call site
// passes a fresh `{ redirectIfNotFound: true|false }` literal).
// Instead we put the heavy work in `readSession` / `readToken`
// (zero-arg, cached) and keep the redirect decision outside.

import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { authService } from '@/features/auth/services/auth.service';
import { logger } from '@/lib/logger';
import { isNextControlError } from '@/lib/next-control-errors';
import { REDIRECT_URL } from './constants';
import type { UserSession } from './types';

// ----- getCurrentSession ---------------------------------------------------

/**
 * Memoized core. Zero-arg so React's `cache()` dedupes every call
 * within a render. The redirect decision lives outside this — see
 * the `getCurrentSessionOrRedirect` / `getCurrentSessionOrNull`
 * helpers below.
 */
const readSession = cache(async (): Promise<UserSession | null> => {
  try {
    const { isAuthenticated, getToken } = await auth();
    const token = await getToken();

    if (!isAuthenticated || !token) return null;

    // `null` here can mean any non-2xx from the api (down, 500,
    // network) — NOT just "session invalid". We deliberately do NOT
    // `revokeSession` on null: a transient api blip would otherwise
    // log every signed-in user out, forcing them through sign-in
    // while Clerk is perfectly healthy. The redirect in
    // `getCurrentSessionOrRedirect` is the right bounce — the user
    // tries again, the api recovers, the render works.
    const session = await authService.getOrSyncMyUserSession(token);

    return session;
  } catch (cause) {
    if (isNextControlError(cause)) throw cause;
    logger.warn({ cause }, 'getCurrentSession: unexpected failure');
    return null;
  }
});

async function getCurrentSessionOrRedirect(): Promise<UserSession> {
  const session = await readSession();
  if (!session) redirect(REDIRECT_URL);
  return session;
}

async function getCurrentSessionOrNull(): Promise<UserSession | null> {
  return readSession();
}

// All overloads + the implementation are `async function` so they
// satisfy Next's `'use server'` rule that exports must be async
// functions (ts(71011)). The overload discrimination happens at
// call-site, not at runtime.
export async function getCurrentSession(options: { redirectIfNotFound: true }): Promise<UserSession>;
export async function getCurrentSession(options?: { redirectIfNotFound?: false }): Promise<UserSession | null>;
export async function getCurrentSession(options: { redirectIfNotFound?: boolean } = {}): Promise<UserSession | null> {
  return options.redirectIfNotFound ? getCurrentSessionOrRedirect() : getCurrentSessionOrNull();
}

// ----- getCurrentToken -----------------------------------------------------

const readToken = cache(async (): Promise<string | null> => {
  try {
    const { isAuthenticated, getToken } = await auth();
    if (!isAuthenticated) return null;
    return await getToken();
  } catch (cause) {
    if (isNextControlError(cause)) throw cause;
    logger.warn({ cause }, 'getCurrentToken: unexpected failure');
    return null;
  }
});

async function getCurrentTokenOrRedirect(): Promise<string> {
  const token = await readToken();
  if (!token) redirect(REDIRECT_URL);
  return token;
}

async function getCurrentTokenOrNull(): Promise<string | null> {
  return readToken();
}

export async function getCurrentToken(options: { redirectIfNotFound: true }): Promise<string>;
export async function getCurrentToken(options?: { redirectIfNotFound?: false }): Promise<string | null>;
export async function getCurrentToken(options: { redirectIfNotFound?: boolean } = {}): Promise<string | null> {
  return options.redirectIfNotFound ? getCurrentTokenOrRedirect() : getCurrentTokenOrNull();
}
