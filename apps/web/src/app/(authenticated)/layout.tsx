import type { ReactNode } from 'react';
import { getCurrentSession } from '@/features/auth/actions';

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
