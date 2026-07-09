// Clerk middleware. Public routes skip the auth gate; everything else is
// protected via `auth.protect()`. `createRouteMatcher` is deprecated in
// @clerk/nextjs v7+, so we route-match inline against the pathname
// inside the middleware handler.

import { clerkMiddleware } from '@clerk/nextjs/server';

const PUBLIC_PREFIXES = ['/auth', '/api/webhooks'];
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
  ],
};
