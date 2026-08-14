import type { Metadata, Viewport } from 'next';
import { Fira_Code, Inter, Merriweather } from 'next/font/google';
import type { ReactNode } from 'react';
import { Navbar } from '@/components/layout/navbar';
import { ThemeProvider } from '@/components/theme-provider';
import { UmamiScript } from '@/components/umami-script';
import { RoleProvider } from '@/features/auth';
import { getCurrentSession } from '@/features/auth/actions';
import { cn } from '@/lib/utils';
import { Providers } from './providers';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const merriweather = Merriweather({ subsets: ['latin'], variable: '--font-serif' });
const firacode = Fira_Code({ subsets: ['latin'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: 'Web Project Template',
  description: 'Plantilla de tienda.',
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
  // Read the session server-side once so the whole tree can call
  // `useRole()` from client components without re-fetching. `null` for
  // anonymous visitors — the provider is mounted either way so the
  // hooks degrade to `null`/`false` instead of throwing on public pages.
  const session = await getCurrentSession({ redirectIfNotFound: false });

  return (
    <html
      lang="es"
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      className={cn('font-sans', inter.variable, merriweather.variable, firacode.variable)}
    >
      <body className="flex min-h-screen flex-col bg-background text-foreground">
        {/* Umami analytics — single self-hosted `<script>` tag.
            Dev never tracks (NODE_ENV gate inside the component).
            See `apps/web/src/components/umami-script.tsx`. */}
        <UmamiScript />
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
        >
          Saltar al contenido
        </a>
        {/* ThemeProvider outermost: feeds `useTheme()` to Sonner
            (components/ui/sonner.tsx) and to the ThemeToggle. `attribute="class"`
            matches the `@custom-variant dark` hook in globals.css. */}
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <Providers>
            <RoleProvider value={session}>
              <Navbar />
              <main id="contenido" className="flex flex-1 flex-col">
                {children}
              </main>
            </RoleProvider>
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
