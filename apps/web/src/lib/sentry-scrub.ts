// Shared `beforeSend` scrubber for the web Sentry configs (browser,
// server, edge). No Node-only APIs — must stay edge-safe.

import type { Event } from '@sentry/nextjs';

/**
 * Sentry v11 `dataCollection` (replaces `sendDefaultPii`): collect no user
 * info, cookies, headers, query params, HTTP bodies or DB query data.
 */
export const NO_PII_DATA_COLLECTION = {
  userInfo: false,
  cookies: false,
  httpHeaders: false,
  httpBodies: [],
  urlQueryParams: false,
  databaseQueryData: false,
};

const REDACTED_HEADERS = new Set(['authorization', 'cookie', 'x-api-key']);

/**
 * Strips request body, cookies, sensitive headers and IP from an
 * event/transaction before it's sent to GlitchTip.
 */
export function scrubEvent<T extends Event>(event: T): T {
  const request = event.request;
  if (request) {
    delete request.data;
    delete request.cookies;
    if (request.headers) {
      for (const key of Object.keys(request.headers)) {
        if (REDACTED_HEADERS.has(key.toLowerCase())) delete request.headers[key];
      }
    }
  }
  if (event.user) delete event.user.ip_address;
  return event;
}
