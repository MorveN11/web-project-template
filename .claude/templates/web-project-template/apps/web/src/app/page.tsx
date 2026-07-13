import { auth } from '@clerk/nextjs/server';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { env } from '@/lib/env/client';

export default async function HomePage() {
  const { userId } = await auth();
  return (
    <main className="container mx-auto flex flex-1 flex-col items-center justify-center gap-6 px-4 py-16">
      <h1 className="text-4xl font-bold tracking-tight">Web Project Template</h1>
      <p className="max-w-prose text-center text-muted-foreground">
        Template storefront. Auth via Clerk, server actions for writes, API layer at{' '}
        <code className="font-mono text-sm">/api</code>.
      </p>
      {userId ? (
        <Button>
          <Link href="/dashboard">Open dashboard</Link>
        </Button>
      ) : (
        <Button>
          <Link href={env.NEXT_PUBLIC_CLERK_SIGN_IN_URL}>Sign in</Link>
        </Button>
      )}
    </main>
  );
}
