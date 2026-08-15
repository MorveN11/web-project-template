'use client';

// Client-side role context and hooks.
//
// The root layout mounts `<RoleProvider>` (no props) around the tree —
// even when no user is signed in. That way client components can call
// `useRole()` / `useIsAdmin()` / `useIsClient()` without crashing on
// anonymous visitors: hooks degrade to `null` / `false` instead of
// throwing, so guards like `<IfRole>` can be used unconditionally.
//
// The provider is stateful: it reads Clerk state via `useUser()` and
// fetches the api's `/users/me` to reconcile the DB-side role. This
// keeps Clerk's `auth()` (which reads `headers()`) OUT of the shared
// layout, so public routes can prerender statically.
//
// Loading state: `useRole()` returns `null` while Clerk or the api is
// resolving — same surface as the anonymous case, so downstream
// branches (AdminNavLink, etc.) already handle it correctly.
//
// Caching — replaces the React `cache()`-memoized server fetch that
// `getCurrentSession()` used to provide, now from the client side:
//
//   - Module-level Map keyed by userId: one api roundtrip per signed-in
//     user per browser session. Clerk rotates the JWT every ~60s but
//     the role is keyed to the user, not the token — so token rotation
//     does NOT invalidate.
//   - React `cache()` wrapper on the per-user fetcher: dedupes when
//     multiple components call it within the same render.
//   - Evict on rejection (transient api blip retries cleanly next
//     render) and on sign-out.

import { UserRole } from '@app/shared-types';
import { useAuth, useUser } from '@clerk/nextjs';
import { cache, createContext, type ReactNode, useContext, useEffect, useState } from 'react';
import { authService } from '@/features/auth/services/auth.service';
import type { UserSession } from '@/features/auth/types';
import { logger } from '@/lib/logger';
import { isNextControlError } from '@/lib/next-control-errors';

const RoleContext = createContext<UserSession | null>(null);

// ----- module-level cache --------------------------------------------------

const sessionByUserId = new Map<string, Promise<UserSession | null>>();

function clearSessionCache(): void {
  sessionByUserId.clear();
}

// React `cache()` dedupes callers within a single render — same shape as
// the old server-side `readSession`. Caches the in-flight promise so a
// second subscriber awaits the first.
const fetchSessionCached = cache(async (userId: string, token: string): Promise<UserSession | null> => {
  const inflight = sessionByUserId.get(userId);
  if (inflight) return inflight;
  const promise = authService.getOrSyncMyUserSession(token);
  sessionByUserId.set(userId, promise);
  // Evict on rejection — next render retries cleanly. Successful fetches
  // stay cached until the user signs out (see `clearSessionCache()`).
  promise.catch(() => {
    sessionByUserId.delete(userId);
  });
  return promise;
});

// ----- provider -----------------------------------------------------------

export function RoleProvider({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, user } = useUser();
  const { getToken } = useAuth();
  const [session, setSession] = useState<UserSession | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn || !user) {
      clearSessionCache();
      setSession(null);
      return;
    }
    // Depend on `user.id` (stable across token rotation) not `user`
    // (Clerk returns a fresh object on every render of `useUser`).
    const userId = user.id;
    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        if (cancelled) return;
        if (!token) {
          setSession(null);
          return;
        }
        const next = await fetchSessionCached(userId, token);
        if (cancelled) return;
        setSession(next);
      } catch (cause) {
        if (isNextControlError(cause)) throw cause;
        logger.warn({ cause }, 'RoleProvider: getOrSyncMyUserSession failed');
        if (!cancelled) setSession(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, user, getToken]);

  return <RoleContext.Provider value={session}>{children}</RoleContext.Provider>;
}

/**
 * Read the current session from React context.
 *
 * Returns `null` for anonymous visitors — callers that need a non-null
 * session should branch on the result rather than assume.
 */
export function useRole(): UserSession | null {
  return useContext(RoleContext);
}

/** `true` when the current session is an admin (anonymous → `false`). */
export function useIsAdmin(): boolean {
  return useRole()?.role === UserRole.ADMIN;
}

/** `true` when the current session is a client (anonymous → `false`). */
export function useIsClient(): boolean {
  return useRole()?.role === UserRole.CLIENT;
}
