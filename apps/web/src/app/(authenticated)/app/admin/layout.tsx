import { UserRole } from '@app/shared-types';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { getCurrentSession } from '@/features/auth';
import { FALLBACK_REDIRECT_URL } from '@/features/auth/constants';

interface Props {
  children: ReactNode;
}

// Admin gate. ADMIN-only — non-admins get redirected to
// FALLBACK_REDIRECT_URL (see features/auth/constants.ts). The parent
// (authenticated) layout already enforces the Clerk session, so this
// only runs for signed-in users.
export default async function AdminLayout({ children }: Props) {
  const session = await getCurrentSession({ redirectIfNotFound: true });

  if (session.role !== UserRole.ADMIN) {
    redirect(FALLBACK_REDIRECT_URL);
  }

  return <>{children}</>;
}
