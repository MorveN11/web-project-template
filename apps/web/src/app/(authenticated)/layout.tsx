import type { ReactNode } from 'react';
import { getCurrentSession } from '@/features/auth/actions';

// `(authenticated)` and every route under `/app/*` reads the Clerk
// session server-side for auth/role gating (defence-in-depth on top of
// Clerk middleware in `proxy.ts`). Without this, Next attempts a static
// prerender per route during build and emits a DYNAMIC_SERVER_USAGE
// warning per route that fails. `force-dynamic` bails out cleanly at
// build — no runtime behavior change (admin routes were already going
// to be dynamic). Same pattern as `apps/web/src/app/(public)/health/route.ts`.
export const dynamic = 'force-dynamic';

interface Props {
  children: ReactNode;
}

export default async function AuthenticatedLayout({ children }: Props) {
  // Gate: redirects to REDIRECT_URL (sign-in) if no session. When
  // metadata is missing but the user is signed in, `getCurrentSession`
  // self-syncs against the api and `revalidatePath`s before falling
  // back to the role-error page — so the common first-render race
  // resolves itself without a manual bounce.
  await getCurrentSession({ redirectIfNotFound: true });

  return <>{children}</>;
}
