// Public surface for the auth feature. Import from `@/features/auth`
// — never reach into individual files.
//
// Server-side (read session, gate routes):
//   getCurrentSession({ redirectIfNotFound }) → UserSession | null
//   getCurrentToken({ redirectIfNotFound })   → string | null
//   <RequireRole role={…}>                     → renders children or fallback
//   <IfRole     role={…}>                      → same, sugar at call sites
//
// Client-side (read session in components):
//   <RoleProvider value={session | null}>…</RoleProvider>  // always mounted in the root layout
//   useRole()           → UserSession | null (null when anonymous)
//   useIsAdmin()        → boolean (false when anonymous)
//   useIsClient()       → boolean (false when anonymous)
//
// File layout:
//   actions.ts              — Clerk session entry points, server-action boundary
//   services/auth.service.ts — api calls (HTTP) for the user-session endpoints
//   guards.tsx              — server-side role render guards
//   role-context.tsx        — client-side role context + hooks
//   types.ts                — UserSession, UserRole (re-exported from shared-types)
//   constants.ts            — REDIRECT_URL, FALLBACK_REDIRECT_URL

export {
  getCurrentSession,
  getCurrentToken,
} from './actions';
export { REDIRECT_URL } from './constants';
export { IfRole, RequireRole } from './guards';
export {
  RoleProvider,
  useIsAdmin,
  useIsClient,
  useRole,
} from './role-context';
export { UserRole, type UserSession } from './types';
