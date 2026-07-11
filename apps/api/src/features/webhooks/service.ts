// Clerk webhook sync service. Mirrors Clerk user lifecycle events
// into the local `User` table. We do NOT handle `user.created` here —
// the web's `getCurrentSession` calls `POST /users/me` on first
// authenticated render, which creates the local row + stamps Clerk
// `publicMetadata.{role,userId}` in one round-trip. Subscribing to
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

import type { UserRole } from '@app/shared-types';
import type { UserJSON } from '@clerk/backend';
import type { UserRepository } from '@/features/users/repository';
import { logger } from '@/logger';

export type WebhookOutcome = 'updated' | 'deleted' | 'noop';

export class UserWebhookService {
  constructor(private readonly users: UserRepository) {}

  // `user.updated` — profile fields changed (email, name, avatar).
  // Frontend `POST /users/me` only runs on authenticated renders, so
  // it doesn't catch every profile edit; the webhook covers the gap
  // for background changes (Clerk dashboard edits, OAuth provider
  // updates, etc.). Role field is intentionally NOT updated here —
  // role changes go through the admin POST /users endpoint so they
  // leave a paper trail (BAPI call with service-role credentials,
  // not the webhook).
  async handleUpdated(user: UserJSON): Promise<WebhookOutcome> {
    const existing = await this.users.findByClerkId(user.id);
    if (!existing) {
      // No local row yet — let the frontend's `POST /users/me` self-
      // sync handle the initial mirror. We ack 200 so Clerk doesn't
      // retry; the next webhook or auth render will sync.
      logger.info({ clerkId: user.id }, 'webhook: updated before local row exists; skipping');
      return 'noop';
    }

    const name = [user.first_name, user.last_name].filter(Boolean).join(' ').trim() || null;
    const email = user.email_addresses[0]?.email_address ?? existing.email;

    await this.users.upsert({
      clerkId: user.id,
      email,
      name,
      role: existing.role as UserRole,
    });
    logger.info({ clerkId: user.id }, 'webhook: user updated');
    return 'updated';
  }

  // `user.deleted` — soft-delete in the local table. The Item
  // relation cascades via `onDelete: Cascade` only on hard-delete,
  // so a soft-delete keeps history queryable for audit.
  async handleDeleted(userId: string): Promise<WebhookOutcome> {
    const existing = await this.users.findByClerkId(userId);
    if (!existing) return 'noop';

    await this.users.upsert({
      clerkId: userId,
      email: existing.email,
      name: existing.name,
      role: existing.role as UserRole,
      deletedAt: new Date(),
    });
    logger.info({ clerkId: userId }, 'webhook: user soft-deleted');
    return 'deleted';
  }
}
