import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { env } from '@/lib/env/server';
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

export default function RootLayout({ children }: Props) {
  // t3-oss validates server env here, so a missing CLERK_SECRET_KEY crashes the build.
  void env.CLERK_SECRET_KEY;
  return (
    <html lang="es" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
