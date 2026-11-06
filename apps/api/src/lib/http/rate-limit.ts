// Rate limit middleware factory. Single-instance only — the limiter
// holds an in-memory Map keyed by IP. For horizontal scale-out,
// swap the `store` for a Redis-backed equivalent (the `redis`
// package is already in the runtime manifest, see package.runtime.json).
//
// Applied to /webhooks/clerk and /dev/* only. Business endpoints sit
// behind the Clerk auth gate, which is itself a bottleneck — adding
// another layer there just slows legitimate traffic. Webhook + dev are
// the surfaces that need protection (webhook: signature-verified but
// can still be flooded; dev: unauthenticated by design).

import type { Context } from 'hono';
import { rateLimiter } from 'hono-rate-limiter';
import { env } from './env';

/**
 * Resolve the client IP from the request. Behind Dokploy / a reverse
 * proxy the X-Forwarded-For header carries the real client; trust it
 * when present, fall back to a sentinel. Falls back again to a shared
 * bucket if the header is missing — a coarse over-limit but acceptable
 * for an internal proxy where the header should always be set.
 */
function clientIp(c: Context): string {
  const xff = c.req.header('x-forwarded-for');
  if (xff) return xff.split(',')[0]?.trim() ?? 'unknown';
  const real = c.req.header('x-real-ip');
  if (real) return real;
  return 'unknown';
}

/**
 * Webhook receiver — limit Clerk's signature-verified endpoint so an
 * attacker can't flood it with bogus payloads (each one consumes CPU
 * to verify the Svix HMAC). Normal Clerk traffic fits in ~10 req/min;
 * 100/min gives 10× headroom and a hard ceiling in prod. Dev runs
 * with a higher cap so local stress testing isn't artificially limited.
 */
export const webhookAndDevRateLimiter = rateLimiter({
  windowMs: 60_000,
  limit: env.NODE_ENV === 'production' ? 100 : 1000,
  standardHeaders: 'draft-6',
  keyGenerator: (c) => clientIp(c),
});
