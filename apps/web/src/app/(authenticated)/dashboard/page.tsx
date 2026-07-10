import { fetchMyProfileAction } from '@/features/profile/actions';

export default async function DashboardPage() {
  // The parent (authenticated) layout already gated us via
  // `getCurrentSession` — that helper also self-syncs on missing
  // metadata. Here we go straight to the api's DB-backed
  // `GET /users/me` so the page exercises the full pipeline
  // (api auth → repo → Prisma → wire DTO) instead of just
  // echoing Clerk's session claims.
  const result = await fetchMyProfileAction();

  if (!result.ok) {
    return (
      <section className="container mx-auto px-4 py-12">
        <h2 className="text-2xl font-semibold">Dashboard</h2>
        <p className="mt-2 text-sm text-destructive">
          Couldn't load profile from the api: {result.error.code} — {result.error.message}
        </p>
      </section>
    );
  }

  const profile = result.data;

  return (
    <section className="container mx-auto px-4 py-12">
      <h2 className="text-2xl font-semibold">Dashboard</h2>
      <p className="text-muted-foreground">
        Signed in as <span className="font-mono">{profile.email}</span> · role{' '}
        <span className="font-mono">{profile.role}</span>
      </p>
      <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted-foreground">Local id</dt>
        <dd className="font-mono">{profile.id}</dd>
        <dt className="text-muted-foreground">Clerk id</dt>
        <dd className="font-mono">{profile.clerkId}</dd>
        <dt className="text-muted-foreground">Name</dt>
        <dd>{profile.name ?? '—'}</dd>
        <dt className="text-muted-foreground">Created</dt>
        <dd className="font-mono">{profile.createdAt}</dd>
      </dl>
      <pre className="mt-6 overflow-auto rounded-md bg-muted p-4 text-xs">{JSON.stringify(profile, null, 2)}</pre>
    </section>
  );
}
