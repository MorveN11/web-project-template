import type { Metadata, Viewport } from 'next';
import { Fira_Code, Inter, Merriweather } from 'next/font/google';
import type { ReactNode } from 'react';
import { Navbar } from '@/components/layout/navbar';
import { cn } from '@/lib/utils';

import { Providers } from './providers';
import './globals.css';

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
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={cn('font-sans', inter.variable, merriweather.variable, firacode.variable)}
    >
      <body className="flex min-h-screen flex-col">
        <Providers>
          <Navbar />
          <main className="flex-1">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
