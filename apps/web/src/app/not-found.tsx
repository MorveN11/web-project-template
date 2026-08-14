// Root 404. Next renders this for unmatched routes and for any
// `notFound()` call that isn't caught by a closer not-found.tsx.

import type { Metadata } from 'next';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';

export const metadata: Metadata = {
  title: '404 · Página no encontrada',
  description: 'La página que buscás no existe.',
};

export default function NotFound() {
  return (
    <div className="container mx-auto flex flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <p className="font-mono text-sm text-muted-foreground">Error 404</p>
      <h1 className="text-4xl font-semibold tracking-tight">No encontramos esa página</h1>
      <p className="max-w-prose text-muted-foreground">
        La URL puede estar rota, desactualizada, o el recurso fue movido.
      </p>
      <Link href="/" className={buttonVariants({ className: 'mt-2' })}>
        Volver al inicio
      </Link>
    </div>
  );
}
