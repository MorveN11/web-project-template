import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { BRAND } from '@/lib/contact';

// PWA manifest — drives install prompts, app identity in Google Search
// and OAuth consent screens. Icons live in apps/web/public/ — `rounded`
// is the 512x512 square mark, `mark` is the 512x512 monochrome symbol.
//
// `id` must be same-origin as the document the manifest is served from,
// otherwise Chrome logs "property 'id' ignored, should be same origin as
// document" — read the host from request headers so dev/staging/prod
// all match.
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const requestHeaders = await headers();
  const host = requestHeaders.get('host') ?? '';
  const protocol = requestHeaders.get('x-forwarded-proto') ?? 'https';
  const sameOrigin = host ? `${protocol}://${host}` : '';

  return {
    // App name (not the legal entity). Must match `applicationName`
    // in `layout.tsx` and the Google OAuth consent screen name —
    // see `BRAND.shortName` in `lib/brand.ts`.
    name: BRAND.shortName,
    short_name: BRAND.shortName,
    description: BRAND.description,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    // Window Controls Overlay — desktop PWA gets a custom title bar.
    // Falls back to `display` if the runtime doesn't support WCO.
    display_override: ['window-controls-overlay', 'standalone'],
    background_color: '#F5F0E8',
    theme_color: '#1A1A1A',
    lang: 'es-BO',
    id: sameOrigin,
    icons: [
      {
        src: BRAND.logo.rounded,
        sizes: '512x512',
        type: 'image/webp',
        purpose: 'maskable',
      },
      {
        src: BRAND.logo.mark,
        sizes: '512x512',
        type: 'image/webp',
        purpose: 'any',
      },
    ],
    // PWA install UI screenshots — required for "richer" PWA install
    // dialog on Chrome mobile + desktop. Wide aspect for desktop,
    // default (narrow) for mobile.
    screenshots: [
      {
        src: '/screenshot-wide.png',
        sizes: '1280x720',
        type: 'image/png',
        form_factor: 'wide',
        label: `${BRAND.shortName} — ${BRAND.description}`,
      },
      {
        src: '/screenshot-narrow.png',
        sizes: '750x1334',
        type: 'image/png',
        label: `${BRAND.shortName} — ${BRAND.description}`,
      },
    ],
  };
}
