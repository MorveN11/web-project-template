'use client';

import { ClerkProvider } from '@clerk/nextjs';
import { shadcn } from '@clerk/ui/themes';
import type { ReactNode } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { env } from '@/lib/env/client';

interface Props {
  children: ReactNode;
}

export function Providers({ children }: Props) {
  return (
    <ClerkProvider
      publishableKey={env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
      signInUrl={env.NEXT_PUBLIC_CLERK_SIGN_IN_URL}
      signUpUrl={env.NEXT_PUBLIC_CLERK_SIGN_UP_URL}
      signInFallbackRedirectUrl={env.NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL}
      signUpFallbackRedirectUrl={env.NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL}
      appearance={{ theme: shadcn }}
    >
      {children}
      <Toaster richColors position="top-right" />
    </ClerkProvider>
  );
}
