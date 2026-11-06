# `@app/web`

Next.js 16 frontend (app router, Turbopack). Three concurrent surfaces share the same root layout:

- **Public pages** under `app/(public)/` — marketing, homepage, Clerk SignIn / SignUp
- **Authenticated app** under `app/(authenticated)/` — any logged-in user; default landing for sign-ins
- **Admin zone** under `app/(authenticated)/admin/` — admin-only sub-layout gates the role

## Run

```bash
pnpm dev:web                  # next dev with Turbopack
```

Open http://localhost:3000. The web reads its own `.env` (`apps/web/.env`) plus whatever the api sets at runtime.

## Layout

```
apps/web/src/
├── app/                                Next.js App Router
│   ├── (public)/                        public pages — homepage, Clerk sign-in/up
│   │   ├── page.tsx                    → /
│   │   └── auth/                        → /auth/* (Clerk SignIn / SignUp)
│   ├── (authenticated)/                 any logged-in user — private routes live under /app/*
│   │   ├── layout.tsx                  ← auth gate (redirects on no session)
│   │   └── app/                         ← all private URLs (matches proxy.ts PRIVATE_PREFIX)
│   │       ├── dashboard/page.tsx       → /app/dashboard
│   │       └── admin/                   ADMIN-only (sub-layout gates role)
│   │           ├── layout.tsx          ← admin gate (redirects non-admins)
│   │           └── page.tsx             → /app/admin
│   ├── globals.css                      Tailwind v4 + Clerk shadcn theme
│   ├── layout.tsx                      root layout — reads session, wraps <RoleProvider>
│   ├── robots.ts                        MetadataRoute — blocks crawlers on private routes
│   └── providers.tsx                    client-side provider stack (Clerk, Toaster)
├── components/
│   ├── layout/                          Navbar + Footer
│   └── ui/                              shadcn/ui primitives
├── features/
│   ├── auth/                           server actions + role guards + client context
│   │   ├── actions.ts                  getCurrentSession, getCurrentToken, ensureDefaultRoleAction
│   │   ├── guards.tsx                  <RequireRole>, <IfRole>
│   │   ├── role-context.tsx            <RoleProvider>, useRole(), useIsAdmin(), useIsClient()
│   │   ├── types.ts                    UserSession, UserRole (re-export)
│   │   ├── constants.ts                REDIRECT_URL, ROLE_ERROR_URL
│   │   └── index.ts                    barrel
│   └── profile/                         api client + typed wrappers
└── lib/
    ├── api-client.ts                   thin fetch wrapper (Bearer header support)
    ├── env/                             t3-oss env validation (client + server schemas)
    ├── safe-action.ts                  Result wrapper for server actions
    ├── logger.ts                       dev-only logger (no-op in prod)
    └── utils.ts                        cn() helper + misc
```

## Route groups explained

| Group                       | URL prefix     | Auth                                                               | Role gate |
| --------------------------- | -------------- | ------------------------------------------------------------------ | --------- |
| `(public)`                  | none           | none                                                               | none      |
| `(authenticated)/app`       | `/app/*`       | `getCurrentSession({ redirectIfNotFound: true })`                  | none      |
| `(authenticated)/app/admin` | `/app/admin/*` | inherited from parent + `role !== ADMIN` → `FALLBACK_REDIRECT_URL` | ADMIN     |

**Next.js convention**: groups in `(parens)` don't appear in the URL. `app/(authenticated)/app/admin/page.tsx` resolves to `/app/admin`.

**Private-vs-public is path-driven** — `proxy.ts` treats anything under `/app` as private; everything else is public. Add a new private page by dropping `app/(authenticated)/app/<feature>/page.tsx`. The URL gets `/app/<feature>`. No edit to `proxy.ts` needed.

## Render guards

### Server-side (`features/auth/guards.tsx`)

```tsx
import { RequireRole, IfRole } from '@/features/auth';
import { UserRole } from '@app/shared-types';

// Hides sub-tree unless the current session matches the role
<RequireRole role={UserRole.ADMIN}>
  <DangerButton />
</RequireRole>

// Conditional include — same logic, more readable at call site
<IfRole role={UserRole.ADMIN}>
  <AdminBadge />
</IfRole>

// With explicit fallback
<RequireRole role={UserRole.ADMIN} fallback={<UpgradePrompt />}>
  <DangerButton />
</RequireRole>
```

These are server components. No client JS. The page still renders — the guard just hides sub-trees.

### Client-side (`features/auth/role-context.tsx`)

```tsx
'use client';
import { useRole, useIsAdmin, useIsClient } from '@/features/auth';

function NavLinks() {
  const { firstName, role } = useRole();
  const isAdmin = useIsAdmin();
  return (
    <>
      <Link href="/app/dashboard">Home</Link>
      {isAdmin && <Link href="/app/admin">Admin</Link>}
      <span>{firstName}</span>
    </>
  );
}
```

`RoleProvider` is mounted in the root layout (`app/layout.tsx`), which reads the session server-side and passes a serializable value to the client. Every component in the tree has access without re-fetching Clerk.

### Cache dedup (`cache()` in `features/auth/actions.ts`)

Both `getCurrentSession` and `getCurrentToken` use a zero-arg memoized core (`readSession` / `readToken`) wrapped by a thin public function. The wrapper handles the redirect decision; the core does the work. This way React's `cache()` dedupes every call within a single render — call sites pass an options object (`{ redirectIfNotFound: true }`) but `cache()` keys on arg identity, so a naive `cache(getCurrentSession)` would miss on every call. With this split, `/app/admin` (root layout + auth layout + admin layout + admin page + `<IfRole>` + `<RequireRole>`) does **1** session fetch per render instead of 6.

## Server actions pattern

All server actions are `'use server'` files under `features/<name>/actions.ts`. They:

1. Read auth via `getCurrentToken({ redirectIfNotFound: true })`.
2. Hit the api with the bearer token.
3. Wrap the result in `safeAction(...)` which converts `Result<T>` to a typed `{ ok, data } | { ok, error }` payload.

```ts
'use server';
import { getCurrentToken } from '@/features/auth/actions';
import { safeAction } from '@/lib/safe-action';
import { getMyProfile } from './services/profile.service';

export async function fetchMyProfileAction() {
  const token = await getCurrentToken({ redirectIfNotFound: true });
  return safeAction(() => getMyProfile(token));
}
```

Pattern: never throw from an action — return a typed `Result` so the client can render errors deterministically.

## API client

`lib/api-client.ts` is a 50-line `fetch` wrapper. Every service file in `features/` uses it:

```ts
export async function getMyProfile(token: string) {
  return apiClient.get<Profile>('/users/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
}
```

Returns `Result<T>` (typed `ok | err`). Throw-free — the wrapper catches network errors and HTTP non-2xx, returns a typed envelope.

## Env vars (validated by t3-oss at boot)

| Var                                 | Required | Default                 | Where validated |
| ----------------------------------- | -------- | ----------------------- | --------------- |
| `NEXT_PUBLIC_API_URL`               | —        | `http://localhost:4000` | client env      |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | ✓        | —                       | client env      |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL`     | —        | `/auth/iniciar-sesion`  | client env      |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL`     | —        | `/auth/registro`        | client env      |
| `CLERK_SECRET_KEY`                  | ✓        | —                       | server env      |
| `NODE_ENV`                          | —        | `development`           | server env      |

The `env/` folder has two files — `client.ts` (the `NEXT_PUBLIC_*` set) and `server.ts` (the secret set). `t3-oss` rejects the build if anything is missing.

## Commands

| Command                                                               | What it does                                        |
| --------------------------------------------------------------------- | --------------------------------------------------- |
| `pnpm dev:web`                                                        | next dev (Turbopack, hot reload)                    |
| `pnpm --filter @app/web typecheck`                                    | tsc --noEmit                                        |
| `pnpm --filter @app/web lint`                                         | Biome                                               |
| `pnpm --filter @app/web build`                                        | next build (standalone output → `.next/standalone`) |
| `pnpm --filter @app/web test`                                         | Vitest (currently no tests; pass-with-no-tests)     |
| `docker compose -f docker-compose.prod.yml --env-file .env build web` | Docker image                                        |

## `@/*` paths

Always. Cross-feature imports use `@/features/<x>/...`, cross-module uses `@/lib/...` or `@/components/...`. Sibling imports within a feature stay relative (`./schemas`, `./service`).

## Adding a new role-gated feature — the recipe

1. **Add the feature folder** under `apps/web/src/features/<name>/`:
   - `actions.ts` — server actions calling the api
   - `services/<name>.service.ts` — typed `apiClient` wrappers
   - `types.ts` — DTO shapes
2. **Add the route group** — pick the right one:
   - Public: `app/(public)/<route>/page.tsx` → `/<route>`
   - Any user: `app/(authenticated)/app/<route>/page.tsx` → `/app/<route>`
   - ADMIN-only: `app/(authenticated)/app/admin/<route>/page.tsx` → `/app/admin/<route>`
3. **Wire the render guards** — use `<RequireRole>` / `<IfRole>` for sub-trees within an otherwise accessible page.
4. **Use `useRole()`** in client components to conditionally render nav items or actions.
5. **Verify** with `pnpm typecheck && pnpm --filter @app/web build`.

The boilerplate handles the rest: middleware auth, session cache, role middleware — nothing extra to wire.
