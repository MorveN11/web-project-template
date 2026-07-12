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

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly title: string,
    public readonly detail: string | undefined,
  ) {
    super(detail ?? title);
    this.name = 'ApiError';
  }
}

export interface RequestOptions {
  headers?: HeadersInit;
  /** Override the default `cache: 'no-store'`. */
  cache?: RequestCache;
}

/**
 * Awaitable, fluent builder for a single api request. Returned by
 * `apiClient.{get,post,patch,delete}(path)`.
 *
 * - Awaiting the builder itself fires the request unauthenticated
 *   (the default — most public endpoints work this way).
 * - Chaining `.withAuth(token)` before await fires the request with
 *   a Bearer token.
 *
 * No `unauthed()` method — unauthed is the default. Call `.withAuth`
 * only when you actually need auth.
 */
export class RequestBuilder<T> implements PromiseLike<T> {
  constructor(
    private readonly client: ApiClient,
    private readonly method: string,
    private readonly path: string,
    private readonly body: unknown,
    private readonly options: RequestOptions = {},
  ) {}

  /** Send with a Bearer token. */
  withAuth(token: string): Promise<T> {
    return this.client.execute<T>(token, this.method, this.path, this.body, this.options);
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
  post<T>(path: string, body?: unknown): RequestBuilder<T> {
    return new RequestBuilder<T>(this, 'POST', path, body);
  }

  /** Start a PATCH request. */
  patch<T>(path: string, body?: unknown): RequestBuilder<T> {
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
    body: unknown,
    options: RequestOptions = {},
  ): Promise<T> {
    const url = `${env.NEXT_PUBLIC_API_URL}${path.startsWith('/') ? path : `/${path}`}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(Object.fromEntries(new Headers(options.headers ?? {})) as Record<string, string>),
    };

    // Cache default = no-store (api responses are per-user, never
    // shared). Override via `options.cache` if you really need it.
    const res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: options.cache ?? 'no-store',
      credentials: 'include',
    });

    if (!res.ok) {
      const problem = await res.json().catch(() => null);
      throw new ApiError(
        res.status,
        problem?.error?.code ?? res.statusText,
        problem?.error?.message,
      );
    }

    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }
}

/**
 * Shared singleton — most callers use this directly. Services that
 * need custom behavior construct their own `new ApiClient()`.
 */
export const apiClient = new ApiClient();