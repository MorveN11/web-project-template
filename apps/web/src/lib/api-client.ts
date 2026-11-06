// Base API client — fluent, awaitable, auth-defaults-to-none.
//
// Every method returns a `RequestBuilder<T>` that is itself
// awaitable. Awaiting it fires the request immediately with NO
// authorization — the default. To send a Bearer token, chain
// `.withAuth(token)` BEFORE awaiting:
//
//   const profile = await apiClient.get<Profile>('/users/me').withAuth(token);
//   const health  = await apiClient.get<{ status: string }>('/health');   // no auth
//
// Services extend `ApiClient` and add domain-specific public methods
// that wrap the chain — callers don't see the builder pattern:
//
//   class ProfileService extends ApiClient {
//     getMyProfile(token: string) {
//       return this.get<Profile>('/users/me').withAuth(token);
//     }
//   }
//
// Auth is the only concern here. Anything more complex belongs in a
// higher-level helper.

import { env } from './env/client';
import { logger } from './logger';

// Request bodies: JSON-able value, FormData (multipart), URLSearchParams
// (`application/x-www-form-urlencoded`), or raw Blob (with own content-type).
export type RequestBody = unknown;

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly detail: string | undefined,
  ) {
    super(detail ?? code);
    this.name = 'ApiError';
  }
}

/** Soft-abort signal (Next.js navigation cancelled an in-flight fetch). */
export class AbortError extends Error {
  constructor(message = 'aborted') {
    super(message);
    this.name = 'AbortError';
  }
}

/** Detect Next.js `UND_ERR_SOCKET` / fetch-abort without depending on `node:undici`. */
export function isAbortError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (err.name === 'AbortError') return true;
  const msg = err.message;
  return msg.includes('aborted') || msg.includes('UND_ERR_SOCKET');
}

export interface RequestOptions {
  headers?: HeadersInit;
  /** Override the default `cache: 'no-store'`. */
  cache?: RequestCache;
  /** Optional AbortSignal to forward to `fetch`. */
  signal?: AbortSignal;
}

export interface CacheOptions {
  /** Next.js `revalidate` seconds. `0` means opt out of caching. */
  revalidate?: number;
  /** Next.js `revalidateTag(...)` strings to invalidate from server actions. */
  tags?: string[];
  /** Pass-through `RequestInit.cache` for read fetches; defaults to `'force-cache'`. */
  readCache?: RequestCache;
}

/**
 * Awaitable, fluent builder for a single api request. Returned by
 * `apiClient.{get,post,put,patch,delete}(path)`.
 *
 * - Awaiting the builder itself fires the request unauthenticated
 *   (the default — most public endpoints work this way).
 * - Chaining `.withAuth(token)` before await fires the request with
 *   a Bearer token.
 * - Chaining `.withCache({ revalidate, tags })` wraps the request in
 *   Next's server-side cache for read fetches (GET only).
 *
 * No `unauthed()` method — unauthed is the default. Call `.withAuth`
 * only when you actually need auth.
 */
export class RequestBuilder<T> implements PromiseLike<T> {
  constructor(
    private readonly client: ApiClient,
    private readonly method: string,
    private readonly path: string,
    private readonly body: RequestBody,
    private readonly options: RequestOptions = {},
  ) {}

  /** Send with a Bearer token. */
  withAuth(token: string): Promise<T> {
    return this.client.execute<T>(token, this.method, this.path, this.body, this.options);
  }

  /**
   * Wrap read fetches in Next.js server-side caching. Only meaningful
   * inside Server Components / Actions with GET requests. Mutating
   * methods (POST/PUT/PATCH/DELETE) ignore the cache wrapper.
   */
  withCache(opts: CacheOptions): Promise<T> {
    return this.client.execute<T>(
      undefined,
      this.method,
      this.path,
      this.body,
      {
        ...this.options,
        // tag/revalidate plumbed via a hidden channel in execute().
      } as RequestOptions,
      opts,
    );
  }

  // Make the builder itself awaitable → fires unauthed by default.
  // `await apiClient.get('/health')` hits the api with no Authorization.
  // biome-ignore lint/suspicious/noThenProperty: intentional — RequestBuilder is a PromiseLike so `await apiClient.get(...)` works without `.unauthed()`.
  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null | undefined,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null | undefined,
  ): PromiseLike<TResult1 | TResult2> {
    return this.client
      .execute<T>(undefined, this.method, this.path, this.body, this.options)
      .then(onfulfilled, onrejected);
  }
}

export class ApiClient {
  /** Start a GET request. Await it (unauthed) or chain `.withAuth(token)`. */
  get<T>(path: string): RequestBuilder<T> {
    return new RequestBuilder<T>(this, 'GET', path, undefined);
  }

  /** Start a POST request. */
  post<T>(path: string, body?: RequestBody): RequestBuilder<T> {
    return new RequestBuilder<T>(this, 'POST', path, body);
  }

  /** Start a PUT request. */
  put<T>(path: string, body?: RequestBody): RequestBuilder<T> {
    return new RequestBuilder<T>(this, 'PUT', path, body);
  }

  /** Start a PATCH request. */
  patch<T>(path: string, body?: RequestBody): RequestBuilder<T> {
    return new RequestBuilder<T>(this, 'PATCH', path, body);
  }

  /** Start a DELETE request. */
  delete<T>(path: string): RequestBuilder<T> {
    return new RequestBuilder<T>(this, 'DELETE', path, undefined);
  }

  /**
   * Lower-level — execute an api request. Called by
   * `RequestBuilder.withAuth(token)` and `RequestBuilder.then(...)`.
   * `public` so the builder (same file, no `protected` boundary) can
   * reach it; callers should still use `get/post/patch/delete`.
   */
  async execute<T>(
    token: string | undefined,
    method: string,
    path: string,
    body: RequestBody,
    options: RequestOptions = {},
    cacheOpts: CacheOptions = {},
  ): Promise<T> {
    // Docker fallback: in compose prod the api lives at `http://api:8080`
    // and `NEXT_PUBLIC_API_URL` may be empty. Resolve to localhost when
    // running outside compose (the env validates a default at boot).
    const baseUrl = env.NEXT_PUBLIC_API_URL || 'http://api:8080';
    const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;

    const isJsonBody =
      body !== undefined &&
      !(body instanceof FormData) &&
      !(body instanceof URLSearchParams) &&
      !(body instanceof Blob);

    const headers: Record<string, string> = {
      ...(isJsonBody ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(Object.fromEntries(new Headers(options.headers ?? {})) as Record<string, string>),
    };

    // Dev-only request tracing. No token, no body — only metadata. The
    // logger is a no-op in prod (see ./logger.ts), so this carries zero
    // prod cost.
    logger.debug({ method, path, hasAuth: Boolean(token), hasBody: body !== undefined }, 'api:request');
    const startedAt = Date.now();

    // Cache default = no-store (api responses are per-user, never
    // shared). `withCache` callers can override via `options.cache`.
    // Reads also accept Next's revalidate/tags via the hidden
    // `cacheOpts` channel so Server Components can skip per-request
    // work; the `cache` string still controls HTTP semantics.
    const fetchInit: RequestInit = {
      method,
      headers,
      ...(body !== undefined ? { body: isJsonBody ? JSON.stringify(body) : (body as BodyInit) } : {}),
      ...(options.signal ? { signal: options.signal } : {}),
      cache: options.cache ?? 'no-store',
      credentials: 'include',
      // Next.js reads these on server-side `fetch` calls.
      // biome-ignore lint/suspicious/noExplicitAny: Next-specific fetch extension.
      ...(((cacheOpts as any) ?? {}) as Record<string, unknown>),
    };

    let res: Response;
    try {
      res = await fetch(url, fetchInit);
    } catch (cause) {
      // Soft-abort (Next navigation cancelled) — surface as a typed
      // error so `safeAction` can short-circuit instead of treating it
      // as a 500.
      if (isAbortError(cause)) throw new AbortError();
      throw cause;
    }

    const durationMs = Date.now() - startedAt;

    if (!res.ok) {
      const problem = (await res.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
      const code = problem?.error?.code ?? res.statusText;
      const detail = problem?.error?.message;
      logger.warn({ method, path, status: res.status, durationMs, code }, 'api:error');
      throw new ApiError(res.status, code, detail);
    }

    logger.debug({ method, path, status: res.status, durationMs }, 'api:response');

    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }
}

/**
 * Shared singleton — most callers use this directly. Services that
 * need custom behavior construct their own `new ApiClient()`.
 */
export const apiClient = new ApiClient();
