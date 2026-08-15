// Clerk middleware. Filename `proxy.ts` is the Next.js 16 alias for Edge middleware.
//
// Job: gate `/app/*` (admin) routes through Clerk auth. CSP / nonce used to
// live here too, but both are now static in `next.config.ts` `headers()` —
// CSP doesn't change per user, and the nonce pattern forced every layout /
// page to call `headers()`, which made every route dynamic at build time.
// Single source of truth for CSP: `next.config.ts`.

import { clerkMiddleware } from '@clerk/nextjs/server';

const PRIVATE_PREFIX = '/app';

// Opt-in exceptions: public even though Clerk might otherwise redirect.
// `/auth` covers Clerk SignIn/SignUp (Spanish slugs). `/sign-in` +
// `/sign-up` are kept as legacy fallbacks for any bookmarked Clerk
// Account Portal URLs. `/api/webhooks` lets Clerk post webhooks
// without a token.
const PUBLIC_PREFIXES = ['/auth', '/sign-in', '/sign-up', '/api/webhooks'];
// Exact-match public routes (root + health probe).
const PUBLIC_EXACT = new Set(['/', '/health']);

function isPublic(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export default clerkMiddleware(async (auth, request) => {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith(PRIVATE_PREFIX) && !isPublic(pathname)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
    '/__clerk/:path*',
  ],
};
