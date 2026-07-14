// AuthService — HTTP client for the user-session endpoints on the api.
//
// Extends `ApiClient` so each method returns a fluent RequestBuilder
// that is awaited after `.withAuth(token)`. The api's GET /me is
// self-reconciling (idempotent sync on the server side), so this
// service exposes one method only — no caller-side 404 retry.
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
   * `GET /users/me` — fetch the local user session. The api
   * reconciles the row on every call (idempotent), so a single GET
   * covers both the common case and first-ever sign-in. Returns
   * `null` only on non-2xx failures (api down, 500, network) so
   * callers can distinguish "no session" from "couldn't reach api".
   *
   * Next.js control-flow errors (redirect, notFound) propagate
   * untouched so the framework can do its job.
   */
  async getOrSyncMyUserSession(token: string): Promise<UserSession | null> {
    try {
      return await this.get<UserSession>('/users/me').withAuth(token);
    } catch (cause) {
      if (isNextControlError(cause)) throw cause;
      if (cause instanceof ApiError) {
        logger.warn({ status: cause.status, cause }, 'authService: getMyUserSession failed');
      } else {
        logger.warn({ cause }, 'authService: getMyUserSession failed');
      }
      return null;
    }
  }
}

/**
 * Shared instance — the only one in the app. Imported wherever the
 * web side needs to talk to the user-session api.
 */
export const authService = new AuthService();
