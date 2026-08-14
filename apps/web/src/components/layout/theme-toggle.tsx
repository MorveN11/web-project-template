'use client';

// Light/dark toggle. The `mounted` flag avoids painting the wrong icon
// during SSR — next-themes cannot know the client's theme until it
// hydrates, and rendering the icon early causes a hydration mismatch.
//
// `resolvedTheme` is what the user actually sees when `theme === 'system'`.

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const current = mounted ? (theme === 'system' ? resolvedTheme : theme) : undefined;
  const isDark = current === 'dark';

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
      title={isDark ? 'Tema claro' : 'Tema oscuro'}
    >
      {/* Placeholder keeps the button from resizing on hydration. */}
      {!mounted && <span className="size-5" aria-hidden="true" />}
      {mounted &&
        (isDark ? <Sun className="size-5" aria-hidden="true" /> : <Moon className="size-5" aria-hidden="true" />)}
    </Button>
  );
}
