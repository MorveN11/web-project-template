import type { MetadataRoute } from 'next';
import { env } from '@/lib/env/client';

// Public-facing sitemap. Excludes `/app/*` (admin/account) — already
// blocked by robots.ts — and `/auth/*` (Clerk sign-in/up). Keep this
// list in sync with the public routes under `app/(public)/`.
//
// Forks with more public marketing routes extend the `routes` array;
// the shape is `({ path, priority, changeFrequency })` per Next's
// `MetadataRoute.Sitemap` items.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  const now = new Date();

  const routes: Array<{
    path: string;
    priority?: number;
    changeFrequency?: MetadataRoute.Sitemap[number]['changeFrequency'];
  }> = [
    { path: '/', priority: 1, changeFrequency: 'weekly' },
    { path: '/auth/iniciar-sesion', priority: 0.4, changeFrequency: 'monthly' },
    { path: '/auth/registro', priority: 0.4, changeFrequency: 'monthly' },
    { path: '/app/dashboard', priority: 0.3, changeFrequency: 'monthly' },
    { path: '/app/admin', priority: 0.3, changeFrequency: 'monthly' },
    { path: '/health', priority: 0.1, changeFrequency: 'yearly' },
  ];

  return routes.map(({ path, priority, changeFrequency }) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  }));
}
