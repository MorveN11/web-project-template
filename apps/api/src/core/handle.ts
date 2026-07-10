// Map a Result<T> into a Hono JSON response. Routes stay two-liners.
//
// `ContentfulStatusCode` in Hono excludes 204 (no-content responses
// don't carry a body), so we extend the allowed-success status union
// with `| 204` and route that case to `c.body(null, 204)`.

import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { Result } from './result';

type SuccessStatus = ContentfulStatusCode | 204;

export function handleResult<T>(result: Result<T>, c: Context, opts?: { successStatus?: SuccessStatus }): Response {
  if (result.success) {
    if (opts?.successStatus === 204) return c.body(null, 204 as ContentfulStatusCode);
    return c.json(result.data, (opts?.successStatus ?? 200) as ContentfulStatusCode);
  }
  const { error } = result;
  return c.json({ error: { code: error.code, message: error.message } }, error.status as ContentfulStatusCode);
}

export function handleVoid(result: Result<void>, c: Context): Response {
  return handleResult(result, c, { successStatus: 204 });
}
