import type { MetadataRoute } from 'next';

import { isDev } from '@/lib/env/server';

// Block everything in non-production so test/staging never leak to search engines.
// In production, allow crawlers but keep private routes out of the index.
export default function robots(): MetadataRoute.Robots {
  if (isDev) {
    return { rules: { userAgent: '*', disallow: '/' } };
  }

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/app/', '/auth/'],
    },
  };
}
