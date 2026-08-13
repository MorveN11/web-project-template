// Clerk middleware. The single rule: anything under `/app` requires auth,
// everything else is public. Adding a new private page = drop it under
// `apps/web/src/app/(authenticated)/app/<feature>/` — no edit here.
//
// `/auth` is public because Clerk's SignIn/SignUp routes live there;
// `auth.protect()` would otherwise loop on `?redirect_url=…`.
// `/api/webhooks` is public so Clerk can post webhooks without a token.
// `/health` is the liveness probe (no auth required).
//
// Filename: `proxy.ts` — the Next.js 16 alias for the Edge middleware
// file. `middleware.ts` is the conventional pre-16 name. We use the
// new alias to stay aligned with what Next 16 documents going forward.
// Next.js issue (vercel/next.js#93328) and rename back to `proxy.ts`
// when fixed upstream.

import { clerkMiddleware } from '@clerk/nextjs/server';

const PRIVATE_PREFIX = '/app';

// Opt-in exceptions: public even though Clerk might otherwise redirect.
const PUBLIC_PREFIXES = ['/auth', '/api/webhooks'];
const PUBLIC_EXACT = new Set(['/', '/health']);

function isPublic(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export default clerkMiddleware(async (auth, request) => {
  const { pathname } = request.nextUrl;

  // Default to public. The only thing that flips to private is the prefix.
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
