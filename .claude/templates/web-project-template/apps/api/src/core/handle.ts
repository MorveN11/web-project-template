// Map a Result<T> into a Hono JSON response. Routes stay two-liners.
//
// `ContentfulStatusCode` in Hono excludes 204 (no-content responses
// don't carry a body), so we extend the allowed-success status union
// with `| 204` and route that case to `c.body(null, 204)`.
//
// Return type stays loose (`any`) so the result can be returned from
// inside `@hono/zod-openapi` route handlers, which demand a
// `TypedResponse` shape we can't statically construct without the
// route's schema context. Runtime behaviour is unchanged: every code
// path returns the `c.json(...)` / `c.body(...)` value Hono produces.

import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { Result } from './result';

type SuccessStatus = ContentfulStatusCode | 204;

// biome-ignore lint/suspicious/noExplicitAny: return type stays `any` so the result can flow back through `@hono/zod-openapi`'s `TypedResponse`-shaped handler signatures — see file header.
export function handleResult<T>(result: Result<T>, c: Context, opts?: { successStatus?: SuccessStatus }): any {
  if (result.success) {
    if (opts?.successStatus === 204) return c.body(null, 204 as ContentfulStatusCode);
    return c.json(result.data, (opts?.successStatus ?? 200) as ContentfulStatusCode);
  }
  const { error } = result;
  return c.json({ error: { code: error.code, message: error.message } }, error.status as ContentfulStatusCode);
}

// biome-ignore lint/suspicious/noExplicitAny: matches handleResult — passes the typed response through the OpenAPIHono handler signature.
export function handleVoid(result: Result<void>, c: Context): any {
  return handleResult(result, c, { successStatus: 204 });
}
