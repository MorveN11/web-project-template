# `@app/web`

Next.js 16 frontend (app router, Turbopack). Three concurrent surfaces share the same root layout:

- **Marketing / auth pages** under `app/(auth)/` — Clerk SignIn / SignUp components, no session required
- **Authenticated app** under `app/(authenticated)/` — any logged-in user; default landing for sign-ins
- **Role-specific zones** under `app/(admin)/` and `app/(client)/` — gated by their `layout.tsx`

## Run

```bash
pnpm dev:web                  # next dev with Turbopack
```

Open http://localhost:3000. The web reads its own `.env` (`apps/web/.env`) plus whatever the api sets at runtime.

## Layout

```
apps/web/src/
├── app/                                Next.js App Router
│   ├── (auth)/                          public sign-in / sign-up
│   ├── (authenticated)/                 any logged-in user — dashboard lives here
│   ├── (admin)/                         ADMIN-only (layout gates role)
│   │   ├── layout.tsx                  ← admin gate (redirects non-admins)
│   │   └── admin/page.tsx               → /admin
│   ├── (client)/                        CLIENT-only (layout gates role)
│   │   ├── layout.tsx                  ← client gate (redirects admins)
│   │   └── client/page.tsx              → /client
│   ├── globals.css                      Tailwind v4 + Clerk shadcn theme
│   ├── layout.tsx                      root layout — reads session, wraps <RoleProvider>
│   ├── page.tsx                         public homepage
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

| Group | URL prefix | Auth | Role gate |
| --- | --- | --- | --- |
| `(authenticated)` | none (default) | `getCurrentSession({ redirectIfNotFound: true })` | none |
| `(admin)` | none | `getCurrentSession({ redirectIfNotFound: true })` + `role !== ADMIN` → `/auth/error-rol` | ADMIN |
| `(client)` | none | `getCurrentSession({ redirectIfNotFound: true })` + `role !== CLIENT` → `/dashboard` | CLIENT |

**Next.js convention**: groups in `(parens)` don't appear in the URL. `app/(admin)/admin/page.tsx` resolves to `/admin`, not `/admin/admin`.

**Why role groups at all** — lets you build role-specific UIs without polluting the URL. Add a new admin page by dropping `app/(admin)/<feature>/page.tsx`; same for client.

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
      <Link href="/dashboard">Home</Link>
      {isAdmin && <Link href="/admin">Admin</Link>}
      {role === UserRole.CLIENT && <Link href="/client">My stuff</Link>}
      <span>{firstName}</span>
    </>
  );
}
```

`RoleProvider` is mounted in the root layout (`app/layout.tsx`), which reads the session server-side and passes a serializable value to the client. Every component in the tree has access without re-fetching Clerk.

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

| Var | Required | Default | Where validated |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | — | `http://localhost:4000` | client env |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | ✓ | — | client env |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | — | `/auth/iniciar-sesion` | client env |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | — | `/auth/registro` | client env |
| `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | — | `/` | client env |
| `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | — | `/` | client env |
| `CLERK_SECRET_KEY` | ✓ | — | server env |
| `NODE_ENV` | — | `development` | server env |

The `env/` folder has two files — `client.ts` (the `NEXT_PUBLIC_*` set) and `server.ts` (the secret set). `t3-oss` rejects the build if anything is missing.

## Commands

| Command | What it does |
| --- | --- |
| `pnpm dev:web` | next dev (Turbopack, hot reload) |
| `pnpm --filter @app/web typecheck` | tsc --noEmit |
| `pnpm --filter @app/web lint` | Biome |
| `pnpm --filter @app/web build` | next build (standalone output → `.next/standalone`) |
| `pnpm --filter @app/web test` | Vitest (currently no tests; pass-with-no-tests) |
| `docker compose -f docker-compose.prod.yml --env-file .env build web` | Docker image |

## `@/*` paths

Always. Cross-feature imports use `@/features/<x>/...`, cross-module uses `@/lib/...` or `@/components/...`. Sibling imports within a feature stay relative (`./schemas`, `./service`).

## Adding a new role-gated feature — the recipe

1. **Add the feature folder** under `apps/web/src/features/<name>/`:
   - `actions.ts` — server actions calling the api
   - `services/<name>.service.ts` — typed `apiClient` wrappers
   - `types.ts` — DTO shapes
2. **Add the route group** — pick the right one:
   - Public: `app/<route>/page.tsx`
   - Any user: `app/(authenticated)/<route>/page.tsx`
   - ADMIN-only: `app/(admin)/<route>/page.tsx`
   - CLIENT-only: `app/(client)/<route>/page.tsx`
3. **Wire the render guards** — use `<RequireRole>` / `<IfRole>` for sub-trees within an otherwise accessible page.
4. **Use `useRole()`** in client components to conditionally render nav items or actions.
5. **Verify** with `pnpm typecheck && pnpm --filter @app/web build`.

The boilerplate handles the rest: middleware auth, session cache, role middleware — nothing extra to wire.
