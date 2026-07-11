// Result wrapper for server actions. Every server action returns either
// { ok: true, data } or { ok: false, error } — never throws across the
// RSC boundary. RHF consumes this shape directly via `formState`.

import { ApiError } from './api-client';
import { logger } from './logger';
import { isNextControlError } from './next-control-error';

export type SafeActionResult<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } };

export async function safeAction<T>(fn: () => Promise<T>): Promise<SafeActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (err) {
    // Never swallow Next's navigation signals — re-throw them so the
    // 302 actually reaches the browser.
    if (isNextControlError(err)) throw err;
    if (err instanceof ApiError) {
      logger.warn({ status: err.status, message: err.message }, 'api call failed');
      return { ok: false, error: { code: String(err.status), message: err.message } };
    }
    logger.error({ err }, 'action threw');
    return { ok: false, error: { code: 'unknown', message: String(err) } };
  }
}
