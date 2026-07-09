import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { Navbar } from '@/components/layout/navbar';
import { env } from '@/lib/env/client';

interface Props {
  children: ReactNode;
}

export default async function AuthenticatedLayout({ children }: Props) {
  const { userId } = await auth();
  if (!userId) redirect(env.NEXT_PUBLIC_CLERK_SIGN_IN_URL);

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">{children}</main>
    </div>
  );
}
