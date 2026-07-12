// ProfileService — extends ApiClient for the fluent request builder,
// adds domain-specific public methods. Every method takes the Clerk
// session token explicitly; the service never reads from Clerk
// context. Token is appended via `.withAuth(token)` on each builder
// chain — no global state, no shared auth config.
//
// Singleton (`profileService` exported below) — no per-call config,
// no factory; just `profileService.getMyProfile(token)`.
//
// NO 'use server' here. Next.js 16 / Turbopack disallows non-async
// exports in 'use server' files, and a class declaration isn't async.
// The 'use server' boundary lives in `features/profile/actions.ts`.

import { ApiClient } from '@/lib/api-client';
import type { Profile } from '../types';

export class ProfileService extends ApiClient {
  /**
   * `GET /users/me` — returns the local DB-backed Profile DTO.
   * Throws ApiError on non-2xx; callers should `try/catch` to detect
   * 404 and trigger `syncMyProfile()`.
   */
  getMyProfile(token: string): Promise<Profile> {
    return this.get<Profile>('/users/me').withAuth(token);
  }

  /**
   * `POST /users/me` — idempotent Clerk ↔ local-DB sync. Creates
   * the local row on first call, stamps `publicMetadata.{role,userId}`
   * on Clerk, and re-syncs name/email/image on subsequent calls.
   * Returns the fresh row.
   */
  syncMyProfile(token: string): Promise<Profile> {
    return this.post<Profile>('/users/me').withAuth(token);
  }
}

/**
 * Single shared instance. Imported wherever profile api calls are
 * needed — no `new ProfileService()` at call sites.
 */
export const profileService = new ProfileService();