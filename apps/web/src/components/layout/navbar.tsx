import { Show, SignInButton, SignUpButton, UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { getCurrentSession } from '@/features/auth/actions';

export async function Navbar() {
  // `redirectIfNotFound: false` keeps signed-out users on the page;
  // the `<Show when="signed-out">` block renders the sign-in/up buttons.
  // The call still runs every render so the nav stays dynamic and
  // doesn't serve a cached stale state.
  const session = await getCurrentSession();
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
      <nav className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/dashboard" className="text-lg font-semibold tracking-tight">
          Web Project Template
        </Link>
        <div className="flex items-center gap-3">
          <Show when="signed-in">
            <UserButton />
          </Show>
          <Show when="signed-out">
            <SignInButton>
              <Button variant="outline" size="sm">
                Sign in
              </Button>
            </SignInButton>
            <SignUpButton>
              <Button size="sm">Sign up</Button>
            </SignUpButton>
          </Show>
          {/* Touch the session so the call doesn't get tree-shaken by
              Turbopack — keeps the nav in the dynamic rendering tree. */}
          {session ? null : null}
        </div>
      </nav>
    </header>
  );
}
