import { UserRole } from '@app/shared-types';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { Navbar } from '@/components/layout/navbar';
import { getCurrentSession } from '@/features/auth';

interface Props {
  children: ReactNode;
}

// Admin gate. ADMIN-only — CLIENTs hitting an admin route get
// redirected to /auth/error-rol (the role-not-defined page doubles
// as the role-not-allowed page).
export default async function AdminLayout({ children }: Props) {
  const session = await getCurrentSession({ redirectIfNotFound: true });

  if (session.role !== UserRole.ADMIN) {
    redirect('/auth/error-rol');
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">{children}</main>
    </div>
  );
}
