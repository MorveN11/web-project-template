'use client';

// Root error boundary. Captures any `throw` that bubbles out of a
// Server Component or Client Component before reaching
// `global-error.tsx`. The root layout (Navbar, Footer) stays mounted,
// so we don't import `globals.css` here — it's already loaded.
//
// Sentry captures the exception. `reset()` retries the failing
// segment. Fork-specific copy / chrome can replace this file.

import * as Sentry from '@sentry/nextjs';
import { AlertTriangle, ArrowLeft, RotateCcw } from 'lucide-react';
import { useEffect } from 'react';

interface Props {
  error: Error & { digest?: string };
  reset?: () => void;
}

export default function RootError({ error, reset }: Props) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <section className="border-b border-border bg-background">
      <div className="container mx-auto flex min-h-[60vh] flex-col items-start justify-center gap-6 px-4 py-16">
        <p className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">
          <AlertTriangle className="size-4" aria-hidden="true" />
          Unexpected error
        </p>
        <h1 className="font-display text-4xl leading-tight sm:text-5xl">Something broke.</h1>
        <p className="max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          We couldn't load what you asked for. The incident was logged — you can retry or head back to the homepage
          while we look into it.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <a
            href="/"
            className="inline-flex items-center gap-2 border-2 border-foreground bg-foreground px-5 py-3 text-sm font-medium uppercase tracking-wider text-background transition-colors hover:bg-background hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to home
          </a>
          {reset ? (
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-2 border-2 border-foreground bg-background px-5 py-3 text-sm font-medium uppercase tracking-wider text-foreground transition-colors hover:bg-foreground hover:text-background"
            >
              <RotateCcw className="size-4" aria-hidden="true" />
              Retry
            </button>
          ) : null}
        </div>

        {error.digest ? <p className="font-mono text-xs text-muted-foreground">Support ref: {error.digest}</p> : null}
      </div>
    </section>
  );
}
