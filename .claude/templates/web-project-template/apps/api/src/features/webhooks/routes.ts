// Clerk webhook receiver. Mounted by `src/index.ts` at `/webhooks/clerk`
// WITHOUT any auth/role middleware — Clerk signs each request with a
// shared secret (`CLERK_WEBHOOK_SIGNING_SECRET`), and `verifyWebhook`
// validates the signature before we dispatch on event type.
//
// Why a single POST handler that dispatches internally:
//   - Clerk's webhook signature covers the raw request body, so we
//     need access to the unparsed `Request` object. Routing the raw
//     body once + dispatching on `evt.type` is simpler than spinning
//     a router per event type.
//   - Future event types (`organization.*`, subscription, etc.) plug
//     in via a single switch in the dispatch function.
//
// Subscribed events: `user.updated`, `user.deleted`. `user.created`
// is intentionally NOT handled here — the web's `getCurrentSession`
// calls `POST /users/me` on first authenticated render, which creates
// the local row + stamps Clerk `publicMetadata.{role,userId}`. Having
// the webhook duplicate that work would race with the frontend sync.
//
// Reliability contract:
//   - 2xx on success → Svix stops retrying.
//   - 4xx on verification failure → permanent reject (don't retry).
//   - 5xx on downstream error → Svix retries with backoff.

import { database } from '@app/db';
import { verifyWebhook, type WebhookEvent } from '@clerk/backend/webhooks';
import { UserRepository } from '@/features/users/repository';
import { logger } from '@/logger';
import { UserWebhookService } from './service';

const service = new UserWebhookService(new UserRepository(database));

export async function handleClerkWebhook(request: Request): Promise<Response> {
  // 1. Verify the signature. Throws on bad signature; we catch and
  //    return 400 so Clerk doesn't retry indefinitely.
  let evt: WebhookEvent;
  try {
    evt = await verifyWebhook(request);
  } catch (err) {
    logger.warn({ err }, 'webhook: signature verification failed');
    return new Response('Webhook signature verification failed', { status: 400 });
  }

  const log = logger.child({ event: evt.type });

  // 2. Dispatch by event type. Add more `case` arms when wiring
  //    other features (orgs, subscriptions, etc.).
  try {
    switch (evt.type) {
      case 'user.created':
        // Intentionally a no-op — frontend `POST /users/me` covers
        // initial sync. Ack 200 so Clerk doesn't retry.
        log.info('webhook: user.created ignored (handled by frontend)');
        return new Response('OK', { status: 200 });

      case 'user.updated': {
        const outcome = await service.handleUpdated(evt.data);
        log.info({ outcome, clerkId: evt.data.id }, 'webhook: handled');
        return new Response('OK', { status: 200 });
      }

      case 'user.deleted': {
        // `user.deleted` carries either a full `UserJSON` (when
        // configured for "deleted user data") or `{ id, deleted: true }`
        // when configured for "only user id". Guard both shapes.
        const id = (evt.data as { id?: string }).id;
        if (!id) {
          log.warn('webhook: user.deleted without id; ignoring');
          return new Response('OK', { status: 200 });
        }
        const outcome = await service.handleDeleted(id);
        log.info({ outcome, clerkId: id }, 'webhook: handled');
        return new Response('OK', { status: 200 });
      }

      default:
        // Events we don't mirror yet → ack with 200 so Clerk doesn't
        // keep retrying.
        log.debug('webhook: unhandled event type');
        return new Response('OK', { status: 200 });
    }
  } catch (err) {
    // 5xx → Svix retries. Log full error for diagnosis.
    log.error({ err }, 'webhook: handler threw');
    return new Response('Internal error', { status: 500 });
  }
}
