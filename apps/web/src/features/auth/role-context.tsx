'use client';

// Client-side role context and hooks.
//
// The root layout reads the session server-side once and passes it
// down through `<RoleProvider value={session}>`. Client components
// then read it via `useRole()` (or the convenience hooks `useIsAdmin`
// / `useIsClient`) without triggering another server round-trip —
// useful for hiding nav items, action buttons, or whole panels based
// on role.
//
// `useRole()` throws if called outside a `<RoleProvider>`. That's
// intentional: it surfaces the wiring mistake loudly instead of
// silently rendering the wrong UI.

import { UserRole } from '@app/shared-types';
import { createContext, type ReactNode, useContext } from 'react';
import type { UserSession } from '@/features/auth/types';

const RoleContext = createContext<UserSession | null>(null);

interface ProviderProps {
  value: UserSession;
  children: ReactNode;
}

export function RoleProvider({ value, children }: ProviderProps) {
  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

/**
 * Read the current session from React context.
 *
 * Throws when called outside a `<RoleProvider>` — that's a wiring
 * mistake (someone forgot to wrap the tree), not a runtime fallback.
 */
export function useRole(): UserSession {
  const ctx = useContext(RoleContext);
  if (!ctx) {
    throw new Error('useRole() called outside <RoleProvider>');
  }
  return ctx;
}

/** `true` when the current session is an admin. */
export function useIsAdmin(): boolean {
  return useRole().role === UserRole.ADMIN;
}

/** `true` when the current session is a client. */
export function useIsClient(): boolean {
  return useRole().role === UserRole.CLIENT;
}
