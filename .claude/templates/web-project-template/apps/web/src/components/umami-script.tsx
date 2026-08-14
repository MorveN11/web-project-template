'use client';

// Umami analytics — self-hosted, single `<script>` tag rendered via
// Next.js `<Script>` (App Router pattern).
//
// Dev never tracks — enforced at runtime, independent of whether
// `NEXT_PUBLIC_UMAMI_*` vars are set. Two-layer disable so a stray
// testing URL leaking into a dev `.env` cannot fire requests from
// the laptop. Mirror of the Sentry dev-never-tracks gate in
// `apps/web/sentry.client.config.ts`.
//
// `strategy="afterInteractive"`: page can render before Umami loads
// — analytics is non-blocking. `beforeInteractive` would delay first
// paint for a non-essential script.

import Script from 'next/script';
import { env as clientEnv } from '@/lib/env/client';

export function UmamiScript(): null | React.JSX.Element {
  // Single gate — only render the script when both vars are present.
  // Deployed envs (testing / production) inject these via Dokploy
  // build args; dev never sets them, so the script never renders
  // locally. Same effect as a NODE_ENV check, with one less env read.
  const { NEXT_PUBLIC_UMAMI_SCRIPT_URL: scriptUrl, NEXT_PUBLIC_UMAMI_WEBSITE_ID: websiteId } = clientEnv;
  if (!scriptUrl || !websiteId) return null;

  return <Script defer src={scriptUrl} data-website-id={websiteId} strategy="afterInteractive" />;
}
