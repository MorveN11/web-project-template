import { UserRole } from '@app/shared-types';
import { getCurrentSession, IfRole, RequireRole } from '@/features/auth';

// Placeholder admin landing page. Replace with real admin views as
// features land. The (admin) layout already gates this page to ADMIN
// role (non-ADMIN → FALLBACK_REDIRECT_URL); the `<RequireRole>` /
// `<IfRole>` guards here are extra examples for use inside sub-trees.
export default async function AdminHomePage() {
  const session = await getCurrentSession({ redirectIfNotFound: true });

  return (
    <section className="container mx-auto px-4 py-12">
      <h2 className="text-2xl font-semibold">Panel de administración</h2>
      <p className="mt-2 text-muted-foreground">
        Sesión iniciada como <span className="font-mono">{session.email}</span>
      </p>

      <div className="mt-6 rounded-md border p-4">
        <h3 className="text-sm font-semibold text-muted-foreground">Demo de guards</h3>
        <p className="mt-2 text-sm">
          El bloque siguiente solo es visible porque el guard del servidor confirmó tu rol:
        </p>
        <IfRole role={UserRole.ADMIN}>
          <p className="mt-2 font-mono text-sm text-green-600">✅ &lt;IfRole role=ADMIN&gt; coincidió</p>
        </IfRole>
      </div>

      <div className="mt-4 rounded-md border p-4">
        <p className="text-sm">Contenido oculto para roles distintos a CLIENT:</p>
        <RequireRole role={UserRole.CLIENT} fallback={null}>
          <p className="mt-2 font-mono text-sm text-red-600">❌ (no debería renderizarse — fallback es null)</p>
        </RequireRole>
      </div>
    </section>
  );
}
