import { UserRole } from '@app/shared-types';
import { getCurrentSession, IfRole, RequireRole } from '@/features/auth';

// Placeholder client landing page. The (client) layout already
// gates this page to CLIENT role (ADMIN → /dashboard).
export default async function ClientHomePage() {
  const session = await getCurrentSession({ redirectIfNotFound: true });

  return (
    <section className="container mx-auto px-4 py-12">
      <h2 className="text-2xl font-semibold">Client home</h2>
      <p className="mt-2 text-muted-foreground">
        Welcome, <span className="font-mono">{session.firstName}</span> · role{' '}
        <span className="font-mono">{session.role}</span>
      </p>

      <div className="mt-6 rounded-md border p-4">
        <h3 className="text-sm font-semibold text-muted-foreground">Guards demo</h3>
        <IfRole role={UserRole.CLIENT}>
          <p className="mt-2 font-mono text-sm text-green-600">✅ &lt;IfRole role=CLIENT&gt; matched</p>
        </IfRole>
      </div>

      <div className="mt-4 rounded-md border p-4">
        <p className="text-sm">ADMIN-only content below:</p>
        <RequireRole role={UserRole.ADMIN} fallback={null}>
          <p className="mt-2 font-mono text-sm text-red-600">❌ (should not render — fallback is null)</p>
        </RequireRole>
      </div>
    </section>
  );
}
