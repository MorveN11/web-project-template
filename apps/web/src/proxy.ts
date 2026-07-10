// Clerk middleware. Public routes skip the auth gate; everything else is
// protected via `auth.protect()`. `createRouteMatcher` is deprecated in
// @clerk/nextjs v7+, so we route-match inline against the pathname
// inside the middleware handler.

import { clerkMiddleware } from '@clerk/nextjs/server';

// Public prefixes — `/sign-in` and `/sign-up` MUST live here, otherwise
// `auth.protect()` fires on Clerk's own auth pages and the browser
// loops on `?redirect_url=…` (Clerk re-encodes the current URL on
// every redirect, producing the runaway nesting seen in bug reports).
const PUBLIC_PREFIXES = ['/auth', '/sign-in', '/sign-up', '/api/webhooks'];
const PUBLIC_EXACT = new Set(['/', '/health']);

function isPublic(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export default clerkMiddleware(async (auth, request) => {
  if (!isPublic(request.nextUrl.pathname)) {
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
