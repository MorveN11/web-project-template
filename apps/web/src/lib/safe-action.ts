// Result wrapper for server actions. Every server action returns either
// `{ ok: true, data }` or `{ ok: false, error }` — never throws across
// the RSC boundary. React Hook Form consumes this shape via
// `formState`.
//
// Errors fall into three buckets:
//   1. ApiError from `apiClient` — preserve `code` (e.g. 'conflict',
//      'not_found') + forward the server `message`.
//   2. AbortError (user navigated mid-fetch) — `code: 'aborted'`.
//      Pages can `isAborted(result)` to skip throwing.
///   3. Other thrown — `code: 'unknown'` + the exception's message.

import { AbortError, ApiError, isAbortError } from './api-client';
import { logger } from './logger';

export type SafeActionResult<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } };

export interface SafeActionError {
  code: string;
  message: string;
}

// ----- error builders (paired with the api's `err*` helpers) -----------

export const unauthorizedError = (message = 'Not authorized.'): SafeActionError => ({
  code: 'unauthorized',
  message,
});
export const badRequestError = (message: string): SafeActionError => ({
  code: 'bad_request',
  message,
});
export const notFoundError = (message = 'Not found.'): SafeActionError => ({
  code: 'not_found',
  message,
});
export const conflictError = (message: string): SafeActionError => ({
  code: 'conflict',
  message,
});
export const internalError = (message = 'Internal error.'): SafeActionError => ({
  code: 'internal_error',
  message,
});

/** True when the action was aborted by a navigation transition (soft-fail). */
export function isAborted<T>(result: SafeActionResult<T>): boolean {
  return !result.ok && result.error.code === 'aborted';
}

export async function safeAction<T>(fn: () => Promise<T>): Promise<SafeActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (err) {
    if (isAbortError(err)) {
      // Soft-abort — the previous render was superseded; the new one
      // has its own action call. Mark as 'aborted' so callers can
      // `if (isAborted(result)) return` instead of throwing a toast.
      return { ok: false, error: { code: 'aborted', message: 'Action aborted.' } };
    }
    if (err instanceof ApiError) {
      logger.warn({ status: err.status, code: err.code, message: err.message }, 'api call failed');
      return { ok: false, error: { code: err.code, message: err.message } };
    }
    logger.error({ err }, 'action threw');
    const message = err instanceof Error ? err.message : 'Unknown error.';
    return { ok: false, error: { code: 'unknown', message } };
  }
}

// Re-export so callers can catch both AbortError and ApiError from
// the same module.
export { AbortError, ApiError, isAbortError };
