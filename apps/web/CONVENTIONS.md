# apps/web/ — Conventions

These are hard-won rules the codebase enforces. Read before adding
new pages, components, or forms.

---

## 1. Component location

`apps/web/src/app/` is for **routes + route-scoped glue** (page.tsx,
layout.tsx, error.tsx, not-found.tsx, route.ts). Never create
reusable components inside `app/`.

Components live in one of two places:

| Folder | Use when |
| --- | --- |
| `apps/web/src/components/<area>/` | Generic — used by ≥ 2 features OR clearly reusable across the app (chrome, layout, shadcn primitives, project-wide primitives like `<ImageUploader>`). |
| `apps/web/src/features/<feature>/components/` | Feature-scoped — used by only one feature (e.g. `features/admin/components/product-form.tsx`). |

`app/` only contains:

- `layout.tsx`, `error.tsx`, `not-found.tsx`, `loading.tsx`,
  `global-error.tsx` — Next.js route conventions
- `page.tsx` (one per route)
- `route.ts` / `route.tsx` (Next.js API routes, e.g.
  `/api/glitchtip-tunnel`)
- Route-group folders `(public)/`, `(authenticated)/` — only for
  organizing pages by access pattern
- Route-scoped files: `manifest.ts`, `robots.ts`, `sitemap.ts`,
  `favicon.ico`, `globals.css`

**Check before adding a `.tsx` to `app/`:**

1. Is this a Next.js route file (`page`, `layout`, `error`,
   `not-found`, `loading`, `route`)? → `app/` is correct.
2. Otherwise: is it a component used by **one** feature? →
   `features/<feature>/components/`.
3. Otherwise: is it a generic component or used by **≥ 2**
   features? → `components/<area>/`.

If the answer to (1) is no and (2)/(3) is yes, **stop** and move the
file. `app/` is not a component folder.

---

## 2. Pagination soft-nav (mandatory for paginated pages)

ANY page that consumes `PaginationResponse<T>` from the api must ship
the three pieces together:

1. `<DataPagination>` from `components/ui/data-pagination.tsx` —
   pure Server Component. Reads `PaginationResponse<T>`, `basePath`,
   `defaultPageSize`, `extraQueryParams`. One client island
   (`<PageSizeSelector>`) handles the `<select>` for size.
2. `<Skeleton>` from `components/ui/skeleton.tsx` — single
   `animate-pulse bg-muted` primitive. Reuse, do not invent new
   shapes.
3. `<Suspense key={JSON.stringify(params)} fallback={<Skeleton/>}>`
   around the data slice inside the page.

```tsx
// Server page with public read
import { Suspense } from 'react';
import { DataPagination } from '@/components/ui/data-pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { listCatalog } from '@/features/catalog';

export default async function Page({ searchParams }: { searchParams: Promise<…> }) {
  const params = await searchParams;
  return (
    <>
      {/* Hero / header stays mounted (outside Suspense). */}
      <Header />

      {/* Data slice = the part that changes on ?page=N. */}
      <Suspense key={JSON.stringify(params)} fallback={<SearchSkeleton />}>
        <SearchResults params={params} />
      </Suspense>
    </>
  );
}
```

**Anti-patterns:**

- Calling `await listCatalog(filters)` at the top of the page
  (no `<Suspense>`): every `?page=N` reloads hero + filters + data.
- Per-page `loading.tsx` on a paginated route: wipes the header on
  every page click.
- Raw `<a>` for `?page=N`: breaks soft-nav. Use `<Link>`.
- Missing `key={JSON.stringify(params)}`: the fallback never
  shows during refetch (React reuses the suspended subtree).

---

## 3. Page widths + layout tokens

**Hero band (every public marketing page):**

```tsx
<section data-section-anchor className="border-b-2 border-foreground">
  <div className="container mx-auto px-4 pt-8 pb-12 md:pt-12 md:pb-16">
    {/* breadcrumb, h1, copy, CTA */}
  </div>
</section>
```

`data-section-anchor` is the target a filter sidebar may
smooth-scroll to on each filter change.

**Editorial middle bands:** use `<Section>` from
`components/ui/section.tsx`. Optional `numero` label ("01", "02"...)
for sections that read as a TOC.

**Single-card landings** (account, unsubscribe, status pages):

```tsx
<div className="container mx-auto max-w-2xl px-4 py-16">
  {/* form / status / copy */}
</div>
```

Not `<Section>` — the editorial eyebrow/title pattern doesn't fit a
single transactional card.

**Allowed size tokens:**

- `container mx-auto px-4` (default).
- `container mx-auto max-w-2xl` (single-card landing).
- `container mx-auto max-w-3xl` (legal text).
- `container mx-auto max-w-7xl` (admin table).

Other sizes are forbidden — they were tried and looked off-grid.

**Forbidden:**

- `<div className="max-w-6xl mx-auto">` (forgot `px-4`).
- `<main className="mx-auto">` (forgot `container`).
- Wrapping a single card in `<Section>` (wrong shape).
- Spreading the hero band across the full window without
  `container mx-auto` (it bleeds past the grid).

---

## 4. Native `<select>` skin rule

**Never use a raw native `<select>` in feature / page code.** Always
import `Select` from `@/components/ui/select`:

```tsx
// ✅ Correct
import { Select } from '@/components/ui/select';

<Select
  value={field.value ?? ''}
  onChange={field.onChange}
  placeholder="Pick a category"
  options={categories.map((c) => ({ value: c.slug, label: c.name }))}
/>

// ❌ Wrong — native chevron collides with the option label
<select className="w-full border-2 border-foreground bg-background px-3 py-2">
  <option value="">Pick a category</option>
  {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
</select>
```

**Why the wrapper exists:** Browsers render the native chevron **on
top** of the option text (overriding `padding-right`). The only fix
is `appearance-none` + our own `ChevronDown` icon + `pr-10` (40px
right padding so the option label clears the icon). Re-implementing
inline = chevron collision + inconsistent skin.

`<Select>` also accepts a `width?: 'toolbar' | 'form'` prop:

- `form` (default): `w-full` — full form-width.
- `toolbar`: `max-w-45 truncate` — fits the filter toolbar rows.

---

## 5. Legal-page block extraction (discriminated unions)

`/legal/privacidad` and `/legal/terminos` typically share ≥ 80% of
their layout with 1-2 prop differences (e.g. an extra "form" link).
When this happens:

- **Don't** use `showFormLink: boolean` — the type system can't
  tell you if you forgot to set it on the privacy variant.
- **Do** use a **discriminated union** — `variant: 'privacy' | 'terms'`
  narrows the rest of the props automatically and refuses to compile
  if a required prop is missing.

```tsx
interface PrivacyProps extends BaseProps {
  variant: 'privacy';
  heading: string;
  paragraph?: string;
  showFormLink: true;
}
interface TermsProps extends BaseProps {
  variant: 'terms';
  heading: string;
  showFormLink?: false;
}
type Props = PrivacyProps | TermsProps;

export function LegalContactBlock(props: Props) {
  const { variant } = props;
  if (variant === 'privacy') {
    return <>...with Form link...</>;
  }
  return <>...without Form link...</>;
}
```

Inside the `variant === 'privacy'` branch the type of
`showFormLink` is narrowed to the literal `true`. Inside the
`'terms'` branch the field doesn't even exist.
