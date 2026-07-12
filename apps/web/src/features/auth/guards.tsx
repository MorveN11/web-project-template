// Role-based render guards for server components.
//
// `<RequireRole role="ADMIN">`      — children render ONLY when the
//                                     current session matches the
//                                     role; otherwise renders null.
//                                     Useful when you want to hide
//                                     sub-trees within an otherwise
//                                     accessible page.
//
// `<IfRole role="ADMIN">…</IfRole>`  — same logic, more obvious at
//                                     the call site when you want
//                                     conditional include.
//
// Both are server components — they read the session via
// `getCurrentSession({ redirectIfNotFound: false })`. No effect on
// the api's role middleware; these are purely UI gates.

import type { UserRole } from '@app/shared-types';
import type { ReactNode } from 'react';
import { getCurrentSession } from './actions';

interface Props {
  role: UserRole;
  /** What to render when the role check fails. Default: render nothing. */
  fallback?: ReactNode;
  children: ReactNode;
}

async function checkRole(role: UserRole): Promise<boolean> {
  // `redirectIfNotFound: false` so unauthenticated users fall through
  // to the fallback (no redirect from inside a render guard).
  const session = await getCurrentSession({ redirectIfNotFound: false });
  return session?.role === role;
}

/**
 * Renders `children` only when the current session's role matches.
 * Otherwise renders `fallback` (or nothing).
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
