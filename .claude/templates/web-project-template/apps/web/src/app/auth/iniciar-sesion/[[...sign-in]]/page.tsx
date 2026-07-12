import { SignIn } from '@clerk/nextjs';

export const dynamic = 'force-dynamic';

export default function SignInPage() {
  return (
    <main className="container mx-auto flex min-h-screen items-center justify-center py-12">
      <SignIn />
    </main>
  );
}
