import { SignIn } from '@clerk/nextjs';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

// If a signed-in user hits this page, bounce them to the dashboard
// rather than rendering the SignIn form (Clerk emits a "cannot render
// when already signed in" warning otherwise). Anonymous traffic falls
// through to the SignIn component below.
export const dynamic = 'force-dynamic';

export default async function SignInPage() {
  const { userId } = await auth();
  if (userId) redirect('/app/dashboard');

  return (
    <main className="container mx-auto flex flex-1 items-center justify-center py-12">
      <SignIn />
    </main>
  );
}
