// Root-level loading UI. Next renders this while a server component
// higher in the tree suspends. Deliberately generic skeleton blocks —
// replace per-route with a `loading.tsx` that mirrors that page's
// layout once the page exists.

export default function Loading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Cargando contenido"
      className="container mx-auto px-4 py-12"
    >
      <div aria-hidden="true" className="flex flex-col gap-3">
        <div className="h-10 w-2/3 animate-pulse rounded-md bg-muted md:w-1/2" />
        <div className="h-4 w-full max-w-2xl animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-5/6 max-w-2xl animate-pulse rounded-md bg-muted" />
        <div className="mt-4 h-10 w-40 animate-pulse rounded-md bg-muted" />
      </div>
    </div>
  );
}
