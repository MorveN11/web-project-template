import { auth } from '@clerk/nextjs/server';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { env } from '@/lib/env/client';
import { HomeStructuredData } from '@/lib/structured-data';

export default async function HomePage() {
  const { userId } = await auth();
  return (
    <main className="container mx-auto flex flex-1 flex-col items-center justify-center gap-6 px-4 py-16">
      {/* schema.org JSON-LD: WebSite + Organization. Home page only. */}
      <HomeStructuredData />
      <h1 className="text-4xl font-bold tracking-tight">Web Project Template</h1>
      <p className="max-w-prose text-center text-muted-foreground">
        Plantilla de tienda. Autenticación con Clerk, server actions para escrituras, capa de API en{' '}
        <code className="font-mono text-sm">/api</code>.
      </p>
      {userId ? (
        <Button>
          <Link href="/app/dashboard">Abrir panel</Link>
        </Button>
      ) : (
        <Button>
          <Link href={env.NEXT_PUBLIC_CLERK_SIGN_IN_URL}>Iniciar sesión</Link>
        </Button>
      )}
    </main>
  );
}
