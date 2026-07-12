import Image from 'next/image';
import { getCurrentSession } from '@/features/auth';

export default async function DashboardPage() {
  // The parent (authenticated) layout already gated us via
  // `getCurrentSession` — that helper also self-syncs on missing
  // metadata. Here we go straight to the api's DB-backed
  // `GET /users/me` so the page exercises the full pipeline
  // (api auth → repo → Prisma → wire DTO) instead of just
  // echoing Clerk's session claims.
  const session = await getCurrentSession({ redirectIfNotFound: true });

  return (
    <section className="container mx-auto px-4 py-12">
      <h2 className="text-2xl font-semibold">Dashboard</h2>
      <p className="text-muted-foreground">
        Signed in as <span className="font-mono">{session.email}</span> · role{' '}
        <span className="font-mono">{session.role}</span>
      </p>
      <div className="mt-6 flex items-center gap-4">
        {session.imageUrl ? (
          <Image
            src={session.imageUrl}
            alt={`${session.firstName} ${session.lastName}`}
            width={64}
            height={64}
            className="size-16 rounded-full border bg-muted object-cover"
          />
        ) : (
          <div className="flex size-16 items-center justify-center rounded-full border bg-muted text-sm font-semibold">
            {session.firstName[0]}
            {session.lastName[0]}
          </div>
        )}
        <div>
          <div className="text-lg font-semibold">
            {session.firstName} {session.lastName}
          </div>
          <div className="text-sm text-muted-foreground">{session.email}</div>
        </div>
      </div>
      <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted-foreground">Local id</dt>
        <dd className="font-mono">{session.id}</dd>
        <dt className="text-muted-foreground">Clerk id</dt>
        <dd className="font-mono">{session.clerkId}</dd>
        <dt className="text-muted-foreground">First name</dt>
        <dd>{session.firstName}</dd>
        <dt className="text-muted-foreground">Last name</dt>
        <dd>{session.lastName}</dd>
        <dt className="text-muted-foreground">Created</dt>
        <dd className="font-mono">{session.createdAt}</dd>
      </dl>
      <pre className="mt-6 overflow-auto rounded-md bg-muted p-4 text-xs">{JSON.stringify(session, null, 2)}</pre>
    </section>
  );
}
