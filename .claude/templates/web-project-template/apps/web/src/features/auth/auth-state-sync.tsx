'use client';

import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

// Clerk signs in/out via soft client navigation, which leaves Next's
// Router Cache serving the stale (pre-auth) RSC — server components
// like the root layout's `getCurrentSession` and the home page's
// `auth()` keep rendering the old state until a hard refresh. Busting
// the cache on every auth-state flip re-runs them with fresh auth.
export function AuthStateSync() {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const prev = useRef<boolean | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    if (prev.current !== null && prev.current !== isSignedIn) {
      router.refresh();
    }
    prev.current = isSignedIn;
  }, [isLoaded, isSignedIn, router]);

  return null;
}
