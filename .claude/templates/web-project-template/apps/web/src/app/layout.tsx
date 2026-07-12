import type { Metadata, Viewport } from 'next';
import { Fira_Code, Inter, Merriweather } from 'next/font/google';
import type { ReactNode } from 'react';
import { Navbar } from '@/components/layout/navbar';
import { cn } from '@/lib/utils';

import { Providers } from './providers';
import './globals.css';
import { RoleProvider } from '@/features/auth';
import { getCurrentSession } from '@/features/auth/actions';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const merriweather = Merriweather({ subsets: ['latin'], variable: '--font-serif' });
const firacode = Fira_Code({ subsets: ['latin'], variable: '--font-mono' });

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
    <html
      lang="es"
      suppressHydrationWarning
      className={cn('font-sans', inter.variable, merriweather.variable, firacode.variable)}
    >
      <body className="flex min-h-screen flex-col">
        <Providers>
          <Navbar />
          <main className="flex-1">{session ? <RoleProvider value={session}>{children}</RoleProvider> : children}</main>
        </Providers>
      </body>
    </html>
  );
}
