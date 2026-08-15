import type { Metadata, Viewport } from 'next';
import { Fira_Code, Inter, Merriweather } from 'next/font/google';
import type { ReactNode } from 'react';
import { Navbar } from '@/components/layout/navbar';
import { ThemeProvider } from '@/components/theme-provider';
import { UmamiScript } from '@/components/umami-script';
import { RoleProvider } from '@/features/auth';
import { BRAND } from '@/lib/contact';
import { env } from '@/lib/env/client';
import { cn } from '@/lib/utils';
import { Providers } from './providers';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const merriweather = Merriweather({ subsets: ['latin'], variable: '--font-serif' });
const firacode = Fira_Code({ subsets: ['latin'], variable: '--font-mono' });

export const metadata: Metadata = {
  // Anchors every relative OG / canonical URL to the deployed hostname.
  metadataBase: new URL(env.NEXT_PUBLIC_SITE_URL),
  // App name shown by Google OAuth consent screen and PWA install prompts.
  // Match the value entered in Google Cloud Console → OAuth consent screen.
  // Source of truth: `BRAND.shortName` in `lib/brand.ts`.
  applicationName: BRAND.shortName,
  title: {
    default: BRAND.shortName,
    template: `%s · ${BRAND.shortName}`,
  },
  description: BRAND.description,
  // Favicon + apple touch icon → brand mark. Removes the implicit
  // `/favicon.ico` 404 on every browser request. Forks override
  // `BRAND.logo.mark` in `lib/contact.ts` to point at their own asset.
  icons: {
    icon: [{ url: BRAND.logo.mark, type: 'image/webp' }],
    apple: BRAND.logo.mark,
  },
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'es_BO',
    url: env.NEXT_PUBLIC_SITE_URL,
    siteName: BRAND.shortName,
    title: BRAND.shortName,
    description: BRAND.description,
  },
  twitter: {
    card: 'summary_large_image',
    title: BRAND.shortName,
    description: BRAND.description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
    },
  },
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
            {/* RoleProvider dentro del ThemeProvider/Providers: cualquier
                client component del árbol (Navbar, Footer, MobileNav, etc.)
                puede leer `useRole()` / `useIsAdmin()` / `useIsClient()`.
                Provider is stateful and fetches the session client-side
                via Clerk hooks — keeps the layout free of `headers()`
                so public routes can prerender. */}
            <RoleProvider>
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
