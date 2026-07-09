import { SignInButton, UserButton } from '@clerk/nextjs';
import { auth } from '@clerk/nextjs/server';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export async function Navbar() {
  const { userId } = await auth();
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
      <nav className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/dashboard" className="text-lg font-semibold tracking-tight">
          Web Project Template
        </Link>
        <div className="flex items-center gap-3">
          {userId ? (
            <UserButton />
          ) : (
            <SignInButton>
              <Button variant="outline" size="sm">
                Sign in
              </Button>
            </SignInButton>
          )}
        </div>
      </nav>
    </header>
  );
}
