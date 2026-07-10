'use server';

import { getCurrentToken } from '@/features/auth/actions';
import { safeAction } from '@/lib/safe-action';
import { getMyProfile } from './services/profile.service';

// Server action wrappers. Auth lives in `@/features/auth/actions` —
// this file is the feature-specific glue around the api call.
//
// Note: sign-in self-sync happens INSIDE `getCurrentSession` when
// Clerk's `publicMetadata.{role,userId}` is missing. There's no
// per-render sync to call from here — the layout stays a thin gate.

// Fetch the caller's profile (read-only).
export async function fetchMyProfileAction() {
  // `redirectIfNotFound: true` narrows the return to `string` — no
  // `if (!token) throw` boilerplate at the call site.
  const token = await getCurrentToken({ redirectIfNotFound: true });
  return safeAction(() => getMyProfile(token));
}