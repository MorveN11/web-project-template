// Public surface for the auth feature.
//
//   Server-side:
//     getCurrentSession({ redirectIfNotFound, requireRole }) → UserSession | null
//     getCurrentToken({ redirectIfNotFound })                → string | null
//
//   Server-side render guards:
//     <RequireRole role={UserRole.ADMIN}>…</RequireRole>
//     <IfRole     role={UserRole.ADMIN}>…</IfRole>
//
//   Client-side:
//     <RoleProvider value={…}>…</RoleProvider>
//     useRole() → RoleContextValue
//     useIsAdmin(), useIsClient()
//
// Conventions:
//   - `auth/actions.ts`     — all Clerk/server-side session work.
//   - `auth/guards.tsx`     — server-component role gates.
//   - `auth/role-context.tsx` — client-side role context + hooks.
//   - `auth/types.ts`       — shared TS shapes (UserSession, UserRole).
//   - `auth/constants.ts`   — route constants (REDIRECT_URL, …).

export {
  getCurrentSession,
  getCurrentToken,
} from './actions';
export { RequireRole, IfRole } from './guards';
export {
  RoleProvider,
  useRole,
  useIsAdmin,
  useIsClient,
  type RoleContextValue,
} from './role-context';
export { UserRole, type UserSession } from './types';
export { REDIRECT_URL, ROLE_ERROR_URL } from './constants';