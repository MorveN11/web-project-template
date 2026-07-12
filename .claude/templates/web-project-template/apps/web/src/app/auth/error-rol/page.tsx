import Link from 'next/link';

// Static page rendered when the user's role was never set (Clerk
// signup race, migration glitch, manual DB intervention). The current
// design has no self-service path — a dev/ops engineer sets the role
// via the api admin endpoint or the Clerk dashboard, then the user
// signs out and back in to pick up the new `publicMetadata.role`.

export default function RoleErrorPage() {
  return (
    <main className="container flex min-h-screen flex-col items-center justify-center gap-4 py-12 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">We couldn&rsquo;t find your role</h1>
      <p className="text-muted-foreground max-w-prose">
        Your account exists, but no role was assigned to it yet. This usually means there&rsquo;s a setup hiccup on our
        side &mdash; reach out to support and we&rsquo;ll get you sorted as quickly as possible.
      </p>
      <div className="flex gap-3">
        <Link
          href="mailto:support@example.com"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Contact support
        </Link>
        <Link href="/auth/iniciar-sesion" className="rounded-md border px-4 py-2 text-sm font-medium">
          Try signing in again
        </Link>
      </div>
    </main>
  );
}
