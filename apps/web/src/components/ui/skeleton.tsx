// Skeleton primitive. `animate-pulse bg-muted` shimmer (shadcn
// generic). Used by `loading.tsx` route stubs and by `<Suspense>`
// fallbacks inside paginated pages.

import { cn } from '@/lib/utils';

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      className={cn('animate-pulse rounded-md bg-muted', className)}
      {...props}
    />
  );
}

export { Skeleton };
