import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { getCurrentSession } from '@/features/auth';
import { RoleProvider } from '@/features/auth/role-context';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Web Project Template',
  description: 'Template storefront.',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: 'black' },
  ],
};

interface Props {
  children: ReactNode;
}

export default async function RootLayout({ children }: Props) {
  // Read the session server-side so the entire tree can call
  // `useRole()` from client components without re-fetching. `null`
  // when not signed in — client hooks should not be reachable on
  // unauthenticated routes, but we pass `null` instead of crashing.
  const session = await getCurrentSession({ redirectIfNotFound: false });

  return (
    <html lang="es" suppressHydrationWarning>
      <body>
        <Providers>
          {session ? (
            <RoleProvider
              value={{
                userId: session.clerkId,
                email: session.email,
                firstName: session.firstName,
                lastName: session.lastName,
                imageUrl: null,
                role: session.role,
              }}
            >
              {children}
            </RoleProvider>
          ) : (
            children
          )}
        </Providers>
      </body>
    </html>
  );
}