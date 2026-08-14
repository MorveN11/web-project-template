'use client';

// Thin re-export of next-themes' provider, per the official pattern
// (https://github.com/pacocoursey/next-themes#installation): a client
// wrapper that forwards the original props. Centralizing the import
// keeps the rest of the app from coupling to `next-themes` directly.
//
// Mounted in app/layout.tsx as:
//   <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { ComponentProps, ReactNode } from 'react';

type NextThemesProps = ComponentProps<typeof NextThemesProvider>;

interface Props extends Omit<NextThemesProps, 'children'> {
  children: ReactNode;
}

export function ThemeProvider({ children, ...props }: Props) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
