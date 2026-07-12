'use client';

import { ClerkProvider } from '@clerk/nextjs';
import { shadcn } from '@clerk/ui/themes';
import type { ReactNode } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { getCurrentSession } from '@/features/auth/actions';
import { RoleProvider } from '@/features/auth/role-context';
import { env } from '@/lib/env/client';

interface Props {
  children: ReactNode;
}

export async function Providers({ children }: Props) {
  // Read the session server-side so the entire tree can call
  // `useRole()` from client components without re-fetching. `null`
  // when not signed in — client hooks should not be reachable on
  // unauthenticated routes, but we pass `null` instead of crashing.
  const session = await getCurrentSession({ redirectIfNotFound: false });

  return (
    <ClerkProvider
      publishableKey={env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
      signInUrl={env.NEXT_PUBLIC_CLERK_SIGN_IN_URL}
      signUpUrl={env.NEXT_PUBLIC_CLERK_SIGN_UP_URL}
      signInFallbackRedirectUrl={env.NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL}
      signUpFallbackRedirectUrl={env.NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL}
      appearance={{ theme: shadcn }}
    >
      {session ? <RoleProvider value={session}>{children}</RoleProvider> : children}
      <Toaster richColors position="top-right" />
    </ClerkProvider>
  );
}
