import type { MetadataRoute } from 'next';

import { isDev } from '@/lib/env/server';

// `robots.txt` — generated per request so the sitemap URLs always point
// at the running host (dev/staging/prod). Dev blocks everything to keep
// localhost out of search engines; prod allows public routes and keeps
// private + API out of the index.
export default function robots(): MetadataRoute.Robots {
  if (isDev) {
    return { rules: { userAgent: '*', disallow: '/' } };
  }

  return {
    // `host` is the canonical domain Google should index. Without it,
    // HTTP→HTTPS migration / www→non-www splits PageRank. Replace with
    // your own canonical domain.
    host: 'https://<your-canonical-domain>',
    sitemap: 'https://<your-canonical-domain>/sitemap.xml',
    rules: [
      // Default: allow public, block private app + auth + API surfaces.
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/app/', '/auth/', '/api/'],
      },
      // AI scrapers — opt out by default. Remove the rule below if you
      // want to let AI bots (GPTBot, CommonCrawl, etc.) train on the
      // catalog copy. Switch to `allow: '/'` to opt in.
      {
        userAgent: ['GPTBot', 'CCBot', 'anthropic-ai', 'Claude-Web', 'PerplexityBot'],
        disallow: '/',
      },
    ],
  };
}
