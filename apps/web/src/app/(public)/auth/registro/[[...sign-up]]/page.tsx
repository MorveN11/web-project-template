import { SignUp } from '@clerk/nextjs';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

// Same redirect-if-already-authed pattern as `/iniciar-sesion` — see
// that page's comment for the rationale.
export const dynamic = 'force-dynamic';

export default async function SignUpPage() {
  const { userId } = await auth();
  if (userId) redirect('/app/dashboard');

  return (
    <main className="container mx-auto flex flex-1 items-center justify-center py-12">
      <SignUp />
    </main>
  );
}
