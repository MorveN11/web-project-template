import { UserRole } from '@app/shared-types';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { getCurrentSession } from '@/features/auth';
import { FALLBACK_REDIRECT_URL } from '@/features/auth/constants';

interface Props {
  children: ReactNode;
}

// Admin gate. ADMIN-only — CLIENTs hitting an admin route get
// redirected to /auth/error-rol (the role-not-defined page doubles
// as the role-not-allowed page).
export default async function AdminLayout({ children }: Props) {
  const session = await getCurrentSession({ redirectIfNotFound: true });

  if (session.role !== UserRole.ADMIN) {
    redirect(FALLBACK_REDIRECT_URL);
  }

  return <>{children}</>;
}
