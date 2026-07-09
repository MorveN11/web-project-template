import { auth } from '@clerk/nextjs/server';
import { getCurrentSession } from '@/features/profile/actions';

export default async function DashboardPage() {
  const { userId } = await auth();
  const session = await getCurrentSession({ redirectIfNotFound: false });

  return (
    <section className="container mx-auto px-4 py-12">
      <h2 className="text-2xl font-semibold">Dashboard</h2>
      <p className="text-muted-foreground">
        Signed in as <span className="font-mono">{userId}</span>.
      </p>
      <pre className="mt-4 overflow-auto rounded-md bg-muted p-4 text-xs">{JSON.stringify(session, null, 2)}</pre>
    </section>
  );
}
