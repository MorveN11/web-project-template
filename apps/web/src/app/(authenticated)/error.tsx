'use client';

// Segment-level error boundary scoped to `/app/**`. Captures throws
// from authenticated routes (account, admin) before they bubble to
// the root `error.tsx`. The `(authenticated)/layout.tsx` stays
// mounted so the segment chrome (admin sidebar or account navbar)
// is preserved when the error fires.
//
// CTAs point to the account/dashboard home — the visitor is already
// signed in; redirecting to the public home is disorienting.
// Fork-specific copy / chrome can replace this file.

import * as Sentry from '@sentry/nextjs';
import { AlertTriangle, ArrowLeft, RotateCcw } from 'lucide-react';
import { useEffect } from 'react';

interface Props {
  error: Error & { digest?: string };
  reset?: () => void;
}

export default function AuthenticatedError({ error, reset }: Props) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <section className="border-b border-border bg-background">
      <div className="container mx-auto flex min-h-[60vh] flex-col items-start justify-center gap-6 px-4 py-16">
        <p className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">
          <AlertTriangle className="size-4" aria-hidden="true" />
          Account error
        </p>
        <h1 className="font-display text-4xl leading-tight sm:text-5xl">Something broke.</h1>
        <p className="max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          The incident was logged in GlitchTip with the support reference below. Retry the action or head back to your
          dashboard.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <a
            href="/app/dashboard"
            className="inline-flex items-center gap-2 border-2 border-foreground bg-foreground px-5 py-3 text-sm font-medium uppercase tracking-wider text-background transition-colors hover:bg-background hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to dashboard
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
