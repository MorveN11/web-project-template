'use server';

// Server-only entry points for the auth feature.
//
// This file is the boundary between Clerk's server SDK and the rest
// of the Next.js app. Every export is wrapped in React's `cache()`
// so a single render reads the session at most once.
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

import { auth, clerkClient } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { authService } from '@/features/auth/services/auth.service';
import { logger } from '@/lib/logger';
import { isNextControlError } from '@/lib/next-control-errors';
import { REDIRECT_URL } from './constants';
import type { UserSession } from './types';

// ----- getCurrentSession ---------------------------------------------------

function _getCurrentSession(options: { redirectIfNotFound: true }): Promise<UserSession>;
function _getCurrentSession(options?: { redirectIfNotFound?: false }): Promise<UserSession | null>;
async function _getCurrentSession({ redirectIfNotFound = false } = {}) {
  try {
    const { isAuthenticated, sessionId, getToken } = await auth();
    const token = await getToken();

    if (!isAuthenticated || !token) {
      if (redirectIfNotFound) redirect(REDIRECT_URL);
      return null;
    }

    // `null` here means the api call failed (down, 500, network) —
    // revoke the Clerk session and bounce the user to sign-in so
    // they retry from a known-clean state.
    const session = await authService.getOrSyncMyUserSession(token);
    if (!session) {
      const client = await clerkClient();
      await client.sessions.revokeSession(sessionId);
      redirect(REDIRECT_URL);
    }

    return session;
  } catch (cause) {
    if (isNextControlError(cause)) throw cause;
    logger.warn({ cause }, 'getCurrentSession: unexpected failure');
    if (redirectIfNotFound) redirect(REDIRECT_URL);
    return null;
  }
}

export const getCurrentSession = cache(_getCurrentSession);

// ----- getCurrentToken -----------------------------------------------------

function _getCurrentToken(options: { redirectIfNotFound: true }): Promise<string>;
function _getCurrentToken(options?: { redirectIfNotFound?: false }): Promise<string | null>;
async function _getCurrentToken({ redirectIfNotFound = false } = {}) {
  try {
    const { isAuthenticated, getToken } = await auth();

    if (!isAuthenticated) {
      if (redirectIfNotFound) redirect(REDIRECT_URL);
      return null;
    }

    return await getToken();
  } catch (cause) {
    if (isNextControlError(cause)) throw cause;
    if (redirectIfNotFound) redirect(REDIRECT_URL);
    return null;
  }
}

export const getCurrentToken = cache(_getCurrentToken);
