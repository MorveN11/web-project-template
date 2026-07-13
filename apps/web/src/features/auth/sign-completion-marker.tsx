'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect, useRef } from 'react';
import { JUST_SIGNED_IN_KEY } from './sign-completion-flag';

// Writes `JUST_SIGNED_IN_KEY` to sessionStorage the moment `useAuth()`
// flips from signed-out to signed-in on the sign-in / sign-up pages.
// AuthStateSync reads the flag on the next page load and calls
// `router.refresh()` to bust the Router Cache.
//
// Without this marker, Clerk's `window.location.href` post-login
// redirect re-mounts the auth state with `prev = null`, defeating the
// transition check inside AuthStateSync.
//
// Mount once on each of the sign-in / sign-up pages next to the
// `<SignIn />` / `<SignUp />` component.
export function SignCompletionMarker() {
  const { isLoaded, isSignedIn } = useAuth();
  const prev = useRef<boolean | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    if (prev.current === false && isSignedIn) {
      sessionStorage.setItem(JUST_SIGNED_IN_KEY, 'true');
    }
    prev.current = isSignedIn;
  }, [isLoaded, isSignedIn]);

  return null;
}
