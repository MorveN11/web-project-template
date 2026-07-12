import { UserRole } from '@app/shared-types';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { getCurrentSession } from '@/features/auth';
import { FALLBACK_REDIRECT_URL } from '@/features/auth/constants';

interface Props {
  children: ReactNode;
}

// Client gate. CLIENT-only — ADMINs hitting a client-only route
// land on /dashboard (admins have their own dashboard at /admin).
export default async function ClientLayout({ children }: Props) {
  const session = await getCurrentSession({ redirectIfNotFound: true });

  if (session.role !== UserRole.CLIENT) {
    redirect(FALLBACK_REDIRECT_URL);
  }

  return <>{children}</>;
}
