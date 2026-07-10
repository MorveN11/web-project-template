'use server';

import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { env } from '@/lib/env/client';
import { safeAction } from '@/lib/safe-action';
import { getMyProfile } from './services/profile.service';

export interface CurrentSession {
  userId: string;
  email: string | null;
  name: string | null;
}

// RSC-cached session lookup. Every export from a `'use server'` file must
// be an async function (Next 16 / Turbopack lint). We declare the
// discriminated return type on the exported const so callers still get
// `Promise<CurrentSession>` when opting into `redirectIfNotFound: true`.
async function _getCurrentSession(opts?: { redirectIfNotFound?: boolean }): Promise<CurrentSession | null> {
  const { userId } = await auth();
  if (!userId) {
    if (opts?.redirectIfNotFound) redirect(env.NEXT_PUBLIC_CLERK_SIGN_IN_URL);
    return null;
  }
  const user = await currentUser();
  return {
    userId,
    email: user?.primaryEmailAddress?.emailAddress ?? null,
    name: user?.fullName ?? user?.firstName ?? null,
  };
}

// Type assertion: runtime guarantee is that `redirectIfNotFound: true` never
// observes a `null` (it redirects first); TS can't prove that from the
// signature alone. Intersection keeps both call shapes without re-declaring
// non-async overloads (Next's `'use server'` lint forbids those).
export const getCurrentSession = cache(_getCurrentSession) as ((opts: {
  redirectIfNotFound: true;
}) => Promise<CurrentSession>) &
  ((opts?: { redirectIfNotFound?: false }) => Promise<CurrentSession | null>);

export async function getCurrentToken(): Promise<string | null> {
  const { getToken } = await auth();
  return getToken();
}

// Server action wrappers. Service layer lives in `./services/profile.service.ts`
// — actions are the auth glue, nothing more.
export async function fetchMyProfileAction() {
  const token = await getCurrentToken();
  if (!token) {
    return { ok: false as const, error: { code: 'unauthenticated', message: 'no session' } };
  }
  return safeAction(() => getMyProfile(token));
}
