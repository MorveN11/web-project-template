// Thin fetch wrapper. No interceptors (caller passes Authorization per
// call so server actions work). ApiError carries HTTP details so the
// `safeAction` wrapper can turn throws into typed results.

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

interface FetchOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
}

async function request<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const url = `${env.NEXT_PUBLIC_API_URL}${path.startsWith('/') ? path : `/${path}`}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    credentials: 'include',
  });

  if (!res.ok) {
    const problem = await res.json().catch(() => null);
    throw new ApiError(res.status, problem?.error?.code ?? res.statusText, problem?.error?.message);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const apiClient = {
  get: <T>(path: string, options?: FetchOptions) => request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: FetchOptions) =>
    request<T>(path, { ...options, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, options?: FetchOptions) =>
    request<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T>(path: string, options?: FetchOptions) => request<T>(path, { ...options, method: 'DELETE' }),
};
