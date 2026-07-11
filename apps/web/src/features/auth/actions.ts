'use server';

// Auth helpers for server components and server actions. Mirrors the
// `~/code/bevent` pattern: rich function overloads that flip between
// "redirect on missing" and "return null" modes, cached per RSC render
// via React `cache()`, and a try/catch envelope that preserves
// Next.js' internal redirect/notFound signals.
//
// Exports:
//   getCurrentSession({ redirectIfNotFound }) → UserSession | null
//     Returns the full Clerk user enriched with `publicMetadata.role`.
//     When `requireRole` (default true) and the role is missing,
//     redirects to ROLE_ERROR_URL — users in that state need a manual
//     admin fix (no self-service path).
//   getCurrentToken({ redirectIfNotFound }) → string | null
//     Returns the current Clerk session JWT, ready for `Authorization:
//     Bearer …` against the api. Redirects to REDIRECT_URL when the
//     caller asks for it and the user isn't authenticated.
//
// Note: the web never writes to Clerk's `publicMetadata` directly.
// All Clerk BAPI mutations live behind the api's `POST /users/me`
// (self-sync, called from `(authenticated)/layout.tsx`), so the
// service-role key never leaves the server.

import { UserRole } from '@app/shared-types';
import { createClerkClient } from '@clerk/backend';
import { auth } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { env } from '@/lib/env/client';
import { env as serverEnv } from '@/lib/env/server';
import { logger } from '@/lib/logger';
import { isNextControlError } from '@/lib/next-control-error';
import { REDIRECT_URL, ROLE_ERROR_URL } from './constants';
import type { UserSession } from './types';

// ----- getCurrentSession ---------------------------------------------------

function _getCurrentSession(options: { redirectIfNotFound: true; requireRole?: boolean }): Promise<UserSession>;
function _getCurrentSession(options?: {
  redirectIfNotFound?: false;
  requireRole?: boolean;
}): Promise<UserSession | null>;
async function _getCurrentSession({ redirectIfNotFound = false, requireRole: requireRoleFlag = true } = {}) {
  try {
    const { userId: clerkUserId, isAuthenticated } = await auth();

    if (!isAuthenticated || !clerkUserId) {
      if (redirectIfNotFound) redirect(REDIRECT_URL);
      return null;
    }

    const clerk = createClerkClient({ secretKey: serverEnv.CLERK_SECRET_KEY });
    const clerkUser = await clerk.users.getUser(clerkUserId);

    const { role, userId } = clerkUser.publicMetadata as {
      role?: string;
      userId?: string;
    };

    // Role / local userId missing → the api's `POST /users/me` can
    // self-sync (stamps Clerk metadata + mirrors local row). Try it
    // before bouncing to the error page — the common case is just
    // a first-render race between Clerk signup and the api webhook.
    if (requireRoleFlag && (!role || !userId)) {
      try {
        const token = await getCurrentToken({ redirectIfNotFound: true });
        const apiUrl = env.NEXT_PUBLIC_API_URL.replace(/\/$/, '');
        const syncRes = await fetch(`${apiUrl}/users/me`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        if (syncRes.ok) {
          // Force the current render tree to re-execute so the
          // now-populated metadata is visible. The JWT still has
          // the stale claims until next refresh, but the local
          // sync + revalidate closes the gap immediately.
          revalidatePath('/', 'layout');
          // Land on a known authed page so the next render hits
          // getCurrentSession with fresh metadata.
          redirect('/dashboard');
        }
        // Sync failed for a non-throw reason (4xx/5xx). Fall through
        // to the error page so devs can see why.
        logger.warn({ status: syncRes.status }, 'selfSync: api call returned non-OK');
      } catch (cause) {
        // Network error / thrown — bubble navigation signals, error
        // page for everything else.
        if (isNextControlError(cause)) throw cause;
        logger.error({ cause }, 'selfSync: api call threw');
      }
      redirect(ROLE_ERROR_URL);
    }

    if (!requireRoleFlag) {
      return {
        id: userId ?? '',
        clerkId: clerkUserId,
        firstName: clerkUser.firstName ?? '',
        lastName: clerkUser.lastName ?? '',
        email: clerkUser.emailAddresses[0]?.emailAddress ?? '',
        role: (role as UserRole) ?? UserRole.CLIENT,
      };
    }

    return {
      id: userId as string,
      clerkId: clerkUserId,
      firstName: clerkUser.firstName ?? '',
      lastName: clerkUser.lastName ?? '',
      email: clerkUser.emailAddresses[0]?.emailAddress ?? '',
      role: role as UserRole,
    };
  } catch (cause) {
    // Never swallow Next's navigation signals — re-throw them so the
    // 302 actually reaches the browser.
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
