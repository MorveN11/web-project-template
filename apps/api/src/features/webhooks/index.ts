// `webhooks` feature — Clerk inbound webhook receiver.
//
// File layout:
//   routes.ts       Single `handleClerkWebhook(request)` entry —
//                   verifies the Clerk signature, dispatches on
//                   `evt.type` to the right service handler.
//   service.ts      `UserWebhookService` — mirrors Clerk user
//                   lifecycle (`user.updated`/`user.deleted`) into
//                   the local `User` table. `user.created` is
//                   intentionally NOT handled — the frontend's
//                   `getCurrentSession` calls `POST /users/me` on
//                   first authenticated render, which creates the
//                   local row + stamps Clerk metadata in one step.
//                   Subscribing to `user.created` here would just
//                   race with the frontend sync.
//
// Public surface: `handleClerkWebhook` (mounted by `src/index.ts` at
// `/webhooks/clerk` as a raw POST handler — no auth/role middleware,
// the signature IS the auth).
export { handleClerkWebhook } from './routes';
