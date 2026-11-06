'use client';

import { esES } from '@clerk/localizations';
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
      appearance={{ theme: shadcn }}
      // The app ships `lang="es"` and Spanish auth routes — keep Clerk's
      // own strings in the same language. Swap for another export of
      // `@clerk/localizations` (or drop the prop) if the app isn't Spanish.
      localization={esES}
    >
      {children}
      <Toaster richColors position="top-right" />
    </ClerkProvider>
  );
}
