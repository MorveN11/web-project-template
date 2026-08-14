import type { MetadataRoute } from 'next';
import { env } from '@/lib/env/client';

// Public-facing sitemap. Excludes `/app/*` (admin) and `/auth/*` (Clerk
// sign-in/up) — both already blocked by robots.ts. Keep this list in
// sync with the routes in `app/(public)/`.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  const now = new Date();

  const routes = [{ path: '/', priority: 1, changeFrequency: 'weekly' as const }];

  return routes.map(({ path, priority, changeFrequency }) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  }));
}
