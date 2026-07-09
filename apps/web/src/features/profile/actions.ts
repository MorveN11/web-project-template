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

// RSC-cached session lookup. Two overloads:
//   no args → returns `CurrentSession | null`
//   `{ redirectIfNotFound: true }` → returns `CurrentSession`, redirects to sign-in otherwise
export function getCurrentSession(opts: { redirectIfNotFound: true }): Promise<CurrentSession>;
export function getCurrentSession(opts?: { redirectIfNotFound?: false }): Promise<CurrentSession | null>;
export async function getCurrentSession(opts?: { redirectIfNotFound?: boolean }) {
  const fn = async (): Promise<CurrentSession | null> => {
    const { userId } = await auth();
    if (!userId) return null;
    const user = await currentUser();
    return {
      userId,
      email: user?.primaryEmailAddress?.emailAddress ?? null,
      name: user?.fullName ?? user?.firstName ?? null,
    };
  };
  return cache(fn)().then((session) => {
    if (!session && opts?.redirectIfNotFound) redirect(env.NEXT_PUBLIC_CLERK_SIGN_IN_URL);
    return session;
  });
}

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
