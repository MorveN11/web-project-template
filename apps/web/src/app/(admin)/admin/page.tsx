import { UserRole } from '@app/shared-types';
import { getCurrentSession, IfRole, RequireRole } from '@/features/auth';

// Placeholder admin landing page. Replace with real admin views as
// features land. The layout already gates this page to ADMIN role
// (CLIENT → /auth/error-rol); the `<RequireRole>` / `<IfRole>` guards
// here are extra examples for use inside sub-trees.
export default async function AdminHomePage() {
  const session = await getCurrentSession({ redirectIfNotFound: true });

  return (
    <section className="container mx-auto px-4 py-12">
      <h2 className="text-2xl font-semibold">Admin dashboard</h2>
      <p className="mt-2 text-muted-foreground">
        Signed in as <span className="font-mono">{session.email}</span>
      </p>

      <div className="mt-6 rounded-md border p-4">
        <h3 className="text-sm font-semibold text-muted-foreground">Guards demo</h3>
        <p className="mt-2 text-sm">
          The following block is only visible because the server-side guard confirmed your role:
        </p>
        <IfRole role={UserRole.ADMIN}>
          <p className="mt-2 font-mono text-sm text-green-600">✅ &lt;IfRole role=ADMIN&gt; matched</p>
        </IfRole>
      </div>

      <div className="mt-4 rounded-md border p-4">
        <p className="text-sm">Hidden CLIENT-only content below:</p>
        <RequireRole role={UserRole.CLIENT} fallback={null}>
          <p className="mt-2 font-mono text-sm text-red-600">❌ (should not render — fallback is null)</p>
        </RequireRole>
      </div>
    </section>
  );
}
