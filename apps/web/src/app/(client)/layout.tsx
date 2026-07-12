import { UserRole } from '@app/shared-types';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { Navbar } from '@/components/layout/navbar';
import { getCurrentSession } from '@/features/auth';

interface Props {
  children: ReactNode;
}

// Client gate. CLIENT-only — ADMINs hitting a client-only route
// land on /dashboard (admins have their own dashboard at /admin).
export default async function ClientLayout({ children }: Props) {
  const session = await getCurrentSession({ redirectIfNotFound: true });

  if (session.role !== UserRole.CLIENT) {
    redirect('/dashboard');
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">{children}</main>
    </div>
  );
}
