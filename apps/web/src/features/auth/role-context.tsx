'use client';

// Client-side role context + hook. The root layout reads the session
// server-side and passes `{ userId, role, firstName, lastName, ... }`
// to <RoleProvider>. Client components read via `useRole()` for
// conditional rendering (show/hide nav items, action buttons, etc.).

import { createContext, useContext, type ReactNode } from 'react';
import { UserRole } from '@app/shared-types';

export interface RoleContextValue {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  imageUrl: string | null;
  role: UserRole;
}

const RoleContext = createContext<RoleContextValue | null>(null);

interface ProviderProps {
  value: RoleContextValue;
  children: ReactNode;
}

export function RoleProvider({ value, children }: ProviderProps) {
  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

/**
 * Read the current user's role from React context.
 * Throws if used outside `<RoleProvider>` — that's a programmer
 * error (someone forgot to wrap the tree), not a runtime fallback.
 */
export function useRole(): RoleContextValue {
  const ctx = useContext(RoleContext);
  if (!ctx) {
    throw new Error('useRole() called outside <RoleProvider>');
  }
  return ctx;
}

/**
 * Render-prop guard for client components. Avoids the server round-trip
 * of `<RequireRole>` when the role is already known client-side.
 *
 *   const { role } = useRole();
 *   {role === UserRole.ADMIN && <AdminButton />}
 *
 * For declarative conditional include in client JSX, see the helper
 * components below.
 */
export function useIsAdmin(): boolean {
  return useRole().role === UserRole.ADMIN;
}

export function useIsClient(): boolean {
  return useRole().role === UserRole.CLIENT;
}