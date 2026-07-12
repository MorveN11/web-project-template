// Server-side render guards: render-or-skip based on the current role.
//
// Both components read the session via `getCurrentSession({
// redirectIfNotFound: false })` — they never redirect, they just hide
// the children when the role doesn't match. Use them to gate
// sub-trees inside an already-accessible page; use the route group
// layouts (`(admin)/`, `(client)/`) to gate whole pages, since
// those can redirect.
//
// `<RequireRole role={UserRole.ADMIN}>` — renders `children` only
// when the current session matches the role; otherwise renders
// `fallback` (or nothing). Use when you need an explicit alternative
// for the unauthorized case.
//
// `<IfRole role={UserRole.ADMIN}>...</IfRole>` — same behavior, just
// reads more naturally at the call site when there's no fallback.
//
// Neither guard enforces auth server-side: the api's role middleware
// is the real gate. These are UI-only.

import type { UserRole } from '@app/shared-types';
import type { ReactNode } from 'react';
import { getCurrentSession } from './actions';

interface Props {
  role: UserRole;
  /** Rendered when the role check fails. Default: render nothing. */
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * `redirectIfNotFound: false` so an unauthenticated request simply
 * falls through to the fallback instead of being redirected from
 * inside a render guard.
 */
async function checkRole(role: UserRole): Promise<boolean> {
  const session = await getCurrentSession({ redirectIfNotFound: false });
  return session?.role === role;
}

/**
 * Renders `children` only when the current session's role matches.
 * Otherwise renders `fallback` (or nothing).
 *
 *   <RequireRole role={UserRole.ADMIN} fallback={<NotAuthorized />}>
 *     <AdminBadge />
 *   </RequireRole>
 */
export async function RequireRole({ role, fallback = null, children }: Props) {
  const allowed = await checkRole(role);
  return allowed ? children : fallback;
}

/**
 * Conditional include — same behavior as `<RequireRole>` but reads
 * more naturally at call sites when there's no fallback to render.
 *
 *   <IfRole role={UserRole.ADMIN}>
 *     <AdminBadge />
 *   </IfRole>
 */
export async function IfRole(props: Props) {
  return RequireRole(props);
}
