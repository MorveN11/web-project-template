import { SignUp } from '@clerk/nextjs';

export const dynamic = 'force-dynamic';

export default function SignUpPage() {
  return (
    <main className="container mx-auto flex min-h-screen items-center justify-center py-12">
      <SignUp />
    </main>
  );
}
