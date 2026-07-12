'use server';

import { getCurrentToken } from '@/features/auth/actions';
import { safeAction } from '@/lib/safe-action';
import { profileService } from './services/profile.service';

// Server action wrappers. Token resolution lives in
// `@/features/auth/actions` (`getCurrentToken`) — that helper handles
// the unauthenticated case (redirects to sign-in or returns null
// depending on the caller's intent). The action layer is the only
// place that reads from Clerk context; services stay pure data-plumbing
// so they're trivially testable with a stub token.
//
// Note: sign-in self-sync happens INSIDE `getCurrentSession` when
// Clerk's `publicMetadata.{role,userId}` is missing. There's no
// per-render sync to call from here — the layout stays a thin gate.

/** Fetch the caller's profile (read-only). */
export async function fetchMyProfileAction() {
  // `redirectIfNotFound: true` narrows the return to `string` — no
  // null check needed at the call site. Unauthenticated callers are
  // bounced to the sign-in route by the auth layer.
  const token = await getCurrentToken({ redirectIfNotFound: true });
  return safeAction(() => profileService.getMyProfile(token));
}
