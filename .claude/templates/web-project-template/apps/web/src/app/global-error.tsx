'use client';

// Root error boundary for the App Router. Next.js renders this when
// any error bubbles out of the root layout — the only place where
// the framework guarantees a fallback exists. Sentry captures the
// error so we see it in GlitchTip even when the rest of the page
// tree is unmounted.
//
// Marked `'use client'` because error boundaries must be client
// components. Keep this minimal — every byte here ships to the
// browser on first paint.

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <h1>Something went wrong!</h1>
      </body>
    </html>
  );
}
