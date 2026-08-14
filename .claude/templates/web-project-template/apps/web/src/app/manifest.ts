import type { MetadataRoute } from 'next';
import { env } from '@/lib/env/client';

// PWA manifest — drives install prompts, app identity in Google Search
// and OAuth consent screens.
//
// Icons: drop `icon-192.png` + `icon-512.png` (or .webp) into
// `apps/web/public/` before shipping. Replace the placeholder paths
// below once the assets exist. Without icons, browsers fall back to
// the favicon (if any) and install prompts may not surface.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Web Project Template',
    short_name: 'WPT',
    description: 'Plantilla de tienda.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    lang: 'es-BO',
    id: env.NEXT_PUBLIC_SITE_URL,
    icons: [
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}
