'use client';

// Client-side role context and hooks.
//
// The root layout ALWAYS mounts `<RoleProvider value={session}>` around
// the tree — even when nobody is signed in. That way any client
// component can call `useRole()` / `useIsAdmin()` / `useIsClient()`
// without crashing on anonymous visitors: the hooks degrade to `null` /
// `false` instead of throwing, so a public navbar can hide an admin
// link without every call site wrapping itself in its own provider.
//
// Server-side role checks still go through `getCurrentSession()` in
// `actions.ts` — these hooks are a UI hint, not a security boundary.

import { UserRole } from '@app/shared-types';
import { createContext, type ReactNode, useContext } from 'react';
import type { UserSession } from '@/features/auth/types';

const RoleContext = createContext<UserSession | null>(null);

interface ProviderProps {
  value: UserSession | null;
  children: ReactNode;
}

export function RoleProvider({ value, children }: ProviderProps) {
  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

/**
 * Read the current session from React context.
 *
 * Returns `null` for anonymous visitors — callers that need a non-null
 * session should branch on the result rather than assume.
 */
export function useRole(): UserSession | null {
  return useContext(RoleContext);
}

/** `true` when the current session is an admin (anonymous → `false`). */
export function useIsAdmin(): boolean {
  return useRole()?.role === UserRole.ADMIN;
}

/** `true` when the current session is a client (anonymous → `false`). */
export function useIsClient(): boolean {
  return useRole()?.role === UserRole.CLIENT;
}
