// Clerk webhook sync service. Mirrors Clerk user lifecycle events
// into the local `User` table. We do NOT handle `user.created` here —
// the api's `getByClerkId` self-syncs on the first authenticated
// render, which creates the local row + stamps Clerk
// `privateMetadata.role` in one round-trip. Subscribing to
// `user.created` would just duplicate that work (and race with it).
//
// Why this lives in the api, not the web app:
//   - The api already owns `User` writes via `features/users`. Centralising
//     the local-table mutations here keeps the `users` module as the
//     single writer.
//   - Webhooks are async — Clerk retries on failure. The api is the
//     service that needs to handle those retries anyway.
//
// Idempotency: every handler is a `findUnique({ clerkId })` followed
// by an `upsert` / `delete`. Replays are safe.
//
// Cache invalidation: every code path that mutates the local `User`
// row also drops both cached entries — `user:session:v1:<clerkId>`
// (the DTO cache) AND `clerk:user:v1:<sub>` (the BAPI memo). Without
// the second one, `syncSelf` would read a stale `auth.role` from the
// BAPI memo, see a mismatch with the freshly-written DB row, and
// re-stamp Clerk + overwrite the DB back to the old role — a 30-60 s
// rollback of any role flip that came in via this webhook.

import type { UserRole } from '@app/shared-types';
import type { UserJSON } from '@clerk/backend';
import type { UserRepository } from '@/features/users/repository';
import { invalidateClerkUserCached } from '@/lib/cache/clerk-user';
import { invalidateUserSessionCached } from '@/lib/cache/user-session';
import { logger } from '@/logger';

export type WebhookOutcome = 'updated' | 'deleted' | 'noop';

export class UserWebhookService {
  constructor(private readonly users: UserRepository) {}

  // `user.updated` — profile fields changed (email, firstName,
  // lastName, imageUrl, avatar). The api's `getByClerkId` only runs
  // on authenticated renders, so it doesn't catch every profile edit;
  // the webhook covers the gap for background changes (Clerk dashboard
  // edits, OAuth provider updates, avatar swaps, etc.). Role field is
  // intentionally NOT updated here — role changes go through the
  // admin POST /users endpoint so they leave a paper trail (BAPI call
  // with service-role credentials, not the webhook).
  async handleUpdated(user: UserJSON): Promise<WebhookOutcome> {
    const existing = await this.users.findByClerkId(user.id);
    if (!existing) {
      // No local row yet — let the api's `getByClerkId` self-sync
      // handle the initial mirror. We ack 200 so Clerk doesn't
      // retry; the next webhook or auth render will sync.
      logger.info({ clerkId: user.id }, 'webhook: updated before local row exists; skipping');
      return 'noop';
    }

    // Clerk requires firstName / lastName at signup. Fall back to
    // existing values when the webhook payload omits them (shouldn't
    // happen, but keeps the row valid even on weird payloads).
    const firstName = user.first_name ?? existing.firstName;
    const lastName = user.last_name ?? existing.lastName;
    const email = user.email_addresses[0]?.email_address ?? existing.email;
    const imageUrl = user.image_url ?? existing.imageUrl ?? null;
    const { role } = user.private_metadata ?? {};

    await this.users.upsert({
      clerkId: user.id,
      email,
      firstName,
      lastName,
      imageUrl,
      role: (role as UserRole) ?? existing.role,
    });
    // The row just changed — drop both caches so the next read pulls
    // fresh data instead of serving the stale email/avatar/role for
    // up to 30s (DTO cache) or rolling back the DB on role mismatch
    // (BAPI memo, see comment at top of file).
    await Promise.all([invalidateUserSessionCached(user.id), invalidateClerkUserCached(user.id)]);
    logger.info({ clerkId: user.id, imageChanged: imageUrl !== existing.imageUrl }, 'webhook: user updated');
    return 'updated';
  }

  // `user.deleted` — soft-delete in the local table. Hard deletes
  // would cascade to any future relations, but a soft-delete keeps
  // history queryable for audit.
  async handleDeleted(userId: string): Promise<WebhookOutcome> {
    const existing = await this.users.findByClerkId(userId);
    if (existing) {
      await this.users.upsert({
        clerkId: userId,
        email: existing.email,
        firstName: existing.firstName,
        lastName: existing.lastName,
        imageUrl: existing.imageUrl,
        role: existing.role as UserRole,
        deletedAt: new Date(),
      });
      // Soft-deleted: both caches are now stale. Drop them so the
      // next authenticated render goes through syncSelf (which honours
      // deletedAt) instead of returning a "live" DTO from cache, and
      // so the JWT verify path doesn't reuse a stale BAPI user for
      // up to 30s.
      await Promise.all([invalidateUserSessionCached(userId), invalidateClerkUserCached(userId)]);
      logger.info({ clerkId: userId }, 'webhook: user soft-deleted');
      return 'deleted';
    }
    return 'noop';
  }
}
