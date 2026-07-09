// Result<T> + AppError. Borrowed from the shared-core idea in montana:
// services return Result<T> instead of throwing, endpoints map to HTTP.
//
// Why: throwing in services makes the failure path invisible to readers
// and forces every caller to remember a try/catch. A typed sum type makes
// the success/failure decision local and exhaustive at the call site.

export interface AppError {
  code: string;
  message: string;
  status: number;
  cause?: unknown;
}

export type Result<T> = { success: true; data: T } | { success: false; error: AppError };

export const ok = <T>(data: T): Result<T> => ({ success: true, data });

export const err = (error: AppError): Result<never> => ({ success: false, error });

// Convenience factories. Match the previous HttpError shape so the
// ApiError → wire mapping stays predictable.

export const errBadRequest = (message: string): AppError => ({
  code: 'bad_request',
  message,
  status: 400,
});

export const errUnauthorized = (message = 'unauthorized'): AppError => ({
  code: 'unauthorized',
  message,
  status: 401,
});

export const errForbidden = (message = 'forbidden'): AppError => ({
  code: 'forbidden',
  message,
  status: 403,
});

export const errNotFound = (message = 'not found'): AppError => ({
  code: 'not_found',
  message,
  status: 404,
});

export const errConflict = (message: string): AppError => ({
  code: 'conflict',
  message,
  status: 409,
});

export const errInternal = (cause?: unknown, message = 'internal error'): AppError => ({
  code: 'internal_error',
  message,
  status: 500,
  cause,
});

/** Narrow helper for callers that want to switch on the union. */
export function isOk<T>(result: Result<T>): result is { success: true; data: T } {
  return result.success;
}

export function unwrap<T>(result: Result<T>): T {
  if (result.success) return result.data;
  throw Object.assign(new Error(result.error.message), { code: result.error.code });
}
