import { SignUp } from '@clerk/nextjs';
import { SignCompletionMarker } from '@/features/auth';

export const dynamic = 'force-dynamic';

export default function SignUpPage() {
  return (
    <main className="container mx-auto flex flex-1 items-center justify-center py-12">
      <SignCompletionMarker />
      <SignUp />
    </main>
  );
}
