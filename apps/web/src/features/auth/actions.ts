'use server';

// Auth helpers for server components and server actions.
//
//   getCurrentSession({ redirectIfNotFound }) → UserSession | null
//     The local DB is the single source of truth for the session.
//     Flow: read Clerk's session → resolve the JWT → call
//     `GET /users/me` on the api → if the row doesn't exist yet
//     (404), call `POST /users/me` (syncSelf) which creates it AND
//     stamps Clerk's publicMetadata in one round-trip → return the
//     fresh local row as the session. The current render always
//     uses the api's response — never the stale JWT claims.
//   getCurrentToken({ redirectIfNotFound }) → string | null
//     Returns the current Clerk session JWT.

import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { profileService } from '@/features/profile/services/profile.service';
import { ApiError } from '@/lib/api-client';
import { logger } from '@/lib/logger';
import { isNextControlError } from '@/lib/next-control-errors';
import { REDIRECT_URL, ROLE_ERROR_URL } from './constants';
import type { UserSession } from './types';

/**
 * Read the local row for the current session. Returns `null` when the
 * row doesn't exist yet AND the sync also failed — caller should
 * redirect to the role error page so the user sees why.
 *
 * Two happy paths:
 *   1. GET /users/me  — local row exists, return it.
 *   2. GET /users/me  → 404 → POST /users/me (sync) → return the
 *      freshly-stamped local row.
 *
 * Either way the returned profile is the api's source of truth — the
 * `clerkUser.publicMetadata` path is no longer needed here.
 */
async function readOrSyncProfile(token: string): Promise<UserSession | null> {
  try {
    return await profileService.getMyProfile(token);
  } catch (cause) {
    if (isNextControlError(cause)) throw cause;
    if (!(cause instanceof ApiError) || cause.status !== 404) {
      logger.warn({ cause }, 'getCurrentSession: getMyProfile threw');
      return null;
    }
    // 404 → local row doesn't exist yet. Trigger syncSelf to create
    // it + stamp Clerk's publicMetadata, then read the fresh row.
    try {
      return await profileService.syncMyProfile(token);
    } catch (syncCause) {
      if (isNextControlError(syncCause)) throw syncCause;
      logger.warn({ syncCause }, 'getCurrentSession: syncMyProfile threw');
      return null;
    }
  }
}

// ----- getCurrentSession ---------------------------------------------------

function _getCurrentSession(options: { redirectIfNotFound: true }): Promise<UserSession>;
function _getCurrentSession(options?: { redirectIfNotFound?: false }): Promise<UserSession | null>;
async function _getCurrentSession({ redirectIfNotFound = false } = {}) {
  try {
    const { isAuthenticated, getToken } = await auth();
    const token = await getToken();

    if (!isAuthenticated || !token) {
      if (redirectIfNotFound) redirect(REDIRECT_URL);
      return null;
    }

    const session = await readOrSyncProfile(token);
    if (!session) {
      // Both GET and POST failed — bounce to the role error page so
      // the user sees why (and so devs can debug).
      redirect(ROLE_ERROR_URL);
    }

    // Pin the clerkId from Clerk's session (not the local row) so it
    // always matches the live session, even if the local row's
    // mirror is briefly stale.
    return session;
  } catch (cause) {
    if (isNextControlError(cause)) throw cause;
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
