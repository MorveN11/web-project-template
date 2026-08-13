import { SignUp } from '@clerk/nextjs';

export const dynamic = 'force-dynamic';

export default function SignUpPage() {
  return (
    <main className="container mx-auto flex flex-1 items-center justify-center py-12">
      <SignUp />
    </main>
  );
}
