// Role-based middleware factory. Pairs with `requireAuth` from
// `./clerk.ts` — always wire `requireAuth` first so `getAuth(c)`
// returns a populated context, then `requireRole(...)` to gate the
// route to specific role(s).
//
// Usage:
//   app.use('/admin/*', requireAuth);
//   app.use('/admin/*', requireRole(UserRole.ADMIN));
//
// `requireRole` throws 403 Forbidden (caught by the global onError)
// when the user's `publicMetadata.role` is null or not in the allowed
// list. Null roles usually mean the default-role action hasn't run
// yet — surface the 403 and let the client redirect to the error page.

import { UserRole, type UserRole as UserRoleType } from '@app/shared-types';
import type { MiddlewareHandler } from 'hono';
import { getAuth, HttpError } from './clerk';

class RoleForbiddenError extends HttpError {
  constructor(allowed: readonly UserRoleType[]) {
    super(403, 'forbidden', `requires role: ${allowed.join(' | ')}`);
    // Override name for clearer error.class.name in logs.
    Object.defineProperty(this, 'name', { value: 'RoleForbiddenError' });
  }
}

export function requireRole(...allowed: UserRoleType[]): MiddlewareHandler {
  if (allowed.length === 0) {
    throw new Error('requireRole() called with no allowed roles');
  }
  return async (c, next) => {
    const auth = getAuth(c);
    if (!auth.role || !allowed.includes(auth.role)) {
      throw new RoleForbiddenError(allowed);
    }
    await next();
  };
}

export { UserRole };
