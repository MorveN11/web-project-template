'use client';

import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { JUST_SIGNED_IN_KEY } from './sign-completion-flag';

// Clerk signs in/out via hard navigation (`window.location.href`), which
// re-mounts this component with `prev = null` and prevents the soft-nav
// transition check from firing. To still bust the Router Cache after a
// hard-nav sign-in/out, we also read a sessionStorage flag that
// `SignCompletionMarker` sets on the sign-in / sign-up pages the moment
// `useAuth()` flips to signed-in — i.e. before Clerk does the redirect.
//
// Mount once inside `<ClerkProvider>` (see `app/providers.tsx`).
export function AuthStateSync() {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const prev = useRef<boolean | null>(null);

  useEffect(() => {
    if (!isLoaded) return;

    const transitioned = prev.current !== null && prev.current !== isSignedIn;
    const justSignedIn = sessionStorage.getItem(JUST_SIGNED_IN_KEY) === 'true';
    if (justSignedIn) sessionStorage.removeItem(JUST_SIGNED_IN_KEY);

    if (transitioned || justSignedIn) {
      router.refresh();
    }

    prev.current = isSignedIn;
  }, [isLoaded, isSignedIn, router]);

  return null;
}
