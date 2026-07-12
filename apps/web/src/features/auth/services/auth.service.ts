// AuthService — HTTP client for the user-session endpoints on the api.
//
// Extends `ApiClient` so each method returns a fluent RequestBuilder
// that is awaited (optionally after `.withAuth(token)`). The service
// adds two domain methods and one composite "read-or-sync" method that
// absorbs the 404-retry pattern callers would otherwise repeat.
//
// Token is always passed explicitly — the service never reads from
// Clerk context. That keeps it framework-agnostic and trivially
// testable.
//
// Singleton (`authService` exported at the bottom) — no factory,
// no per-call config. Import it and call:
//   const session = await authService.getOrSyncMyUserSession(token);
//
// NO 'use server' here. Next.js 16 / Turbopack rejects non-async
// exports in 'use server' files, and a class declaration is sync.
// The 'use server' boundary lives in `features/auth/actions.ts`,
// which is where the web side calls into this service.

import { ApiClient, ApiError } from '@/lib/api-client';
import { logger } from '@/lib/logger';
import { isNextControlError } from '@/lib/next-control-errors';
import type { UserSession } from '../types';

export class AuthService extends ApiClient {
  /**
   * `GET /users/me` — fetch the local DB-backed UserSession DTO for
   * the authenticated user. Throws `ApiError` on non-2xx; callers
   * usually wrap this with `getOrSyncMyUserSession()` to auto-recover
   * from the first-call 404 case.
   */
  getMyUserSession(token: string): Promise<UserSession> {
    return this.get<UserSession>('/users/me').withAuth(token);
  }

  /**
   * `POST /users/me` — idempotent Clerk ↔ local-DB sync. First call
   * creates the local row and stamps Clerk's `publicMetadata.role`
   * + `publicMetadata.userId`; later calls refresh name/email/image
   * from Clerk. Returns the freshly-synced row.
   */
  syncMyUserSession(token: string): Promise<UserSession> {
    return this.post<UserSession>('/users/me').withAuth(token);
  }

  /**
   * Read the local session, transparently syncing on first call.
   *
   * Two paths:
   *   1. `getMyUserSession` → 200 → return it. The common case after
   *      the user has signed in at least once.
   *   2. `getMyUserSession` → 404 → no local row yet → `syncMyUserSession`
   *      creates the row and stamps Clerk's metadata → return it.
   *
   * Returns `null` only when something other than 404 broke (api
   * down, 500, network). The caller should treat null as "we couldn't
   * load the session for an unexpected reason" and bounce the user to
   * the sign-in page. A 404 alone is never surfaced — it always
   * triggers the sync.
   *
   * Next.js control-flow errors (redirect, notFound) always propagate
   * untouched so the framework can do its job.
   */
  async getOrSyncMyUserSession(token: string): Promise<UserSession | null> {
    try {
      return await this.getMyUserSession(token);
    } catch (cause) {
      if (isNextControlError(cause)) throw cause;
      if (!(cause instanceof ApiError) || cause.status !== 404) {
        logger.warn({ cause }, 'authService: getMyUserSession failed (non-404)');
        return null;
      }
      // 404 — local row missing. Run the idempotent sync, which both
      // creates the row and stamps Clerk's publicMetadata.
      try {
        return await this.syncMyUserSession(token);
      } catch (syncCause) {
        if (isNextControlError(syncCause)) throw syncCause;
        logger.warn({ syncCause }, 'authService: syncMyUserSession failed');
        return null;
      }
    }
  }
}

/**
 * Shared instance — the only one in the app. Imported wherever the
 * web side needs to talk to the user-session api.
 */
export const authService = new AuthService();
