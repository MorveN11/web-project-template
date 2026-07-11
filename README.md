# web-project-template

Minimal web project template. pnpm workspaces, two deployable apps + two shared packages. Start here for any new web project — extend with features as the project grows.

---

## TL;DR — first 5 minutes

```bash
# 1. Install + env
pnpm install
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
cp packages/db/.env.example packages/db/.env
# fill in Clerk keys + your local secrets

# 2. Start postgres + apply schema
pnpm compose
pnpm db:migrate:dev

# 3. Run both apps in parallel (hot reload)
pnpm dev

# 4. Open
# web → http://localhost:3000
# api → http://localhost:4000/health
# api docs → http://localhost:4000/docs   (Scalar UI, dev only)
```

---

## Stack

| Layer | Tech |
| --- | --- |
| Package manager | **pnpm 11** (workspaces) |
| Backend | **Hono 4** + `@hono/zod-openapi` (typed routes + OpenAPI 3.1) + **Prisma 7** + `@prisma/adapter-pg` + **@clerk/backend** (JWT verify) + pino logger + Result pattern |
| Frontend | **Next.js 16** (app router, Turbopack) + **Tailwind v4** + **Biome** (lint + format) + **shadcn/ui** + **Clerk** + Server Actions |
| Auth | **Clerk** — shared across api (JWT verification) and web (Next.js SDK). Two roles: `ADMIN`, `CLIENT`. |
| API docs | **@scalar/hono-api-reference** — `/docs` page with live Try-It-Out + JWT auth UI |
| Webhooks | **Svix** (Clerk's webhook infra) — verified via `verifyWebhook()` from `@clerk/backend/webhooks` |
| Database | **Postgres 18** (Docker compose for dev + prod) |
| CI/CD | **GitHub Actions** (PR gate + per-branch release + Dokploy webhook) |
| Format/lint | **Biome** (single tool, replaces eslint + prettier) |

---

## Architecture

### High-level

```
                       ┌──────────────────────────────────┐
                       │   Clerk (hosted auth provider)   │
                       │   - User DB + sessions           │
                       │   - JWT issuance                 │
                       │   - Webhooks (user.updated,…)    │
                       └──────┬─────────────────────┬────┘
                              │ JWT (Authorization:    │ Webhooks
                              │ Bearer …)              │ (Svix-signed)
                              ▼                        ▼
   ┌──────────────────────────────────┐  ┌─────────────────────────┐
   │            apps/api              │  │  /webhooks/clerk        │
   │          (Hono + Node)          │  │   verifyWebhook()       │
   │  /items  /users  /users/me      │  │   → upsert local User   │
   │  /health /docs /openapi.json    │  └─────────────────────────┘
   │  /dev/issue-token (dev only)    │
   └────────┬─────────────────┬──────┘
            │ Prisma 7         │ shared zod schemas
            ▼                  ▼
   ┌─────────────────┐  ┌─────────────────────────────┐
   │   packages/db   │  │     packages/shared-types    │
   │   Prisma schema │  │   cross-cutting + features/ │
   │   + client      │  │   - apiError, pagination    │
   │                 │  │   - item, user (per-domain) │
   └─────────────────┘  └─────────────────────────────┘
            ▲                  ▲
            │                  │
   ┌────────┴──────────────────┴────────┐
   │            apps/web               │
   │          (Next.js 16)             │
   │  app/                             │
   │   auth/  - public sign-in/up      │
   │   (authenticated)/ dashboard      │
   │   (admin)/admin/   ADMIN-only     │
   │   (client)/client/  CLIENT-only   │
   │  features/                        │
   │   auth/   getCurrentSession,      │
   │           guards, role context     │
   │   profile/  api client + types     │
   └───────────────────────────────────┘
```

### Repo layout

```
.
├── apps/
│   ├── api/                     Hono backend (see apps/api/README.md)
│   └── web/                     Next.js frontend (see apps/web/README.md)
├── packages/
│   ├── db/                      Prisma schema + client (see packages/db/README.md)
│   └── shared-types/            zod schemas shared across apps (see packages/shared-types/README.md)
├── docker-compose.yml           dev (postgres only)
├── docker-compose.prod.yml      full stack (prod-like local validation)
├── biome.json                   shared lint + format config
├── tsconfig.base.json           shared TS config (every package extends it)
└── .github/workflows/           ci.yml, release-prod.yml, release-test.yml
```

---

## Development process

### Day-to-day commands

| Task | Command |
| --- | --- |
| Run api + web with hot reload | `pnpm dev` |
| Run only the api | `pnpm dev:api` |
| Run only the web | `pnpm dev:web` |
| Typecheck all packages | `pnpm typecheck` |
| Lint + format | `pnpm lint` / `pnpm lint:fix` |
| Build everything | `pnpm build` |
| Apply Prisma migration (dev) | `pnpm db:migrate:dev` |
| Regenerate Prisma client (after schema change) | `pnpm db:generate` |
| Seed local DB | `pnpm db:seed` |
| Reset DB (drop + recreate) | `pnpm db:migrate:reset` |

### When you change the Prisma schema

```bash
# 1. Edit packages/db/prisma/schema.prisma
# 2. Generate the migration
pnpm db:migrate:dev --name your_change_name
# 3. Confirm the new file in packages/db/prisma/migrations/2026.../migration.sql
# 4. Commit it — every dev / CI / prod pulls the same migration
```

Never `prisma db push` against the prod DB. Always use committed migrations.

### When you add a new env var

Three places, same key, same order:

1. `apps/<app>/src/env.ts` — zod schema with `.default()` or `.min(1)` for required
2. `apps/<app>/.env.example` — placeholder value + comment
3. `apps/<app>/.env` — your actual local value (gitignored)

After editing, `pnpm typecheck` to confirm `env.<KEY>` is type-safe.

### When you add a new zod schema to the wire

`packages/shared-types/src/<cross-cutting|features>/<name>.ts` — owns **both** the zod schema AND the inferred TS type. Then re-export from `packages/shared-types/src/index.ts`. Both api (for request/response validation) and web (for typed fetch helpers) consume from the same file.

---

## Conventions — read these before writing code

### 1. `@/*` paths everywhere

Cross-feature / cross-module imports use the `@/` alias. Sibling imports within a feature stay relative.

```ts
// ✓ cross-module
import { handleResult } from '@/core/handle';
import { itemDtoSchema } from '@app/shared-types';

// ✗ deep relative paths
import { handleResult } from '../../core/handle';
```

Every `tsconfig.json` in the repo declares `paths: { "@/*": ["./src/*"] }`. New packages copy this.

### 2. Features vs infra — directory split

Each **feature** is one folder with the same file layout (`routes.ts` / `schemas.ts` / `service.ts` / `repository.ts` / `mappers.ts` / `index.ts` barrel). **Infra** lives at the top level.

```
src/
├── auth/                  shared infra (auth-related, used by ≥ 2 features)
├── core/                  shared infra (Result, handle)
├── db/                    shared infra
├── openapi/               shared infra (security + responses constants)
├── env.ts                 shared infra
├── logger.ts              shared infra
├── types/                 shared infra (Hono context augmentation)
└── features/
    ├── items/             one feature, one folder
    ├── users/             (auth lives at top because it crosses everything)
    ├── health/
    └── webhooks/
```

If you're tempted to put feature-specific code in a top-level folder, move it under `features/`. If you're tempted to put infra in a feature, move it up.

### 3. Result<T> for every service method

The api's services never throw. They return `Result<T>` (`ok(value)` or `err(AppError)`). The handler in `core/handle.ts` converts that to a Response.

```ts
async list(q: ListQuery): Promise<Result<ItemDto[]>> {
  try {
    const rows = await this.items.list(q);
    return ok(rows.map(toItemDto));
  } catch (cause) {
    return err(errInternal(cause));
  }
}
```

Throw-free flows mean:
- Routes stay two-liners (parse → service → handleResult).
- Error code is typed and uniform across endpoints.
- No surprise stack traces leaking through the wire.

### 4. OpenAPI from zod

Every route declares its request + response via zod schemas. The api auto-registers them with `@hono/zod-openapi`. `c.req.valid('json' | 'param' | 'query')` is type-safe — TS knows the exact shape.

```ts
const createRoute = createRoute({
  method: 'post',
  path: '/',
  security: bearerSecurity,       // shared constant — auth required
  request: {
    body: { content: { 'application/json': { schema: createUserBodySchema } } },
  },
  responses: {
    201: { content: { 'application/json': { schema: userDtoSchema } }, description: 'user created' },
    ...authErrorResponses,         // 401 + 403 spread
    409: conflictResponse[409],     // named response — no inline copy-paste
  },
});
```

`security` + `responses` constants live in `src/openapi/` so every feature reuses the same shape.

### 5. Auth is layered

Three layers, in order:

| Layer | Lives in | Gates |
| --- | --- | --- |
| **Clerk middleware** (proxy.ts) | `apps/web/src/proxy.ts` | Authenticated? If no → sign-in. |
| **Route layout gate** | `app/(admin)/layout.tsx`, `app/(client)/layout.tsx` | Correct role? If no → redirect. |
| **API middleware** | `apps/api/src/auth/clerk.ts`, `apps/api/src/auth/role.ts` | JWT valid? Role allowed? If no → 401/403. |

UI render guards (`<RequireRole>`, `<IfRole>`, `useRole()`) hide sub-trees without affecting the API gate. Use them to make pages look clean, but never as the only security check.

### 6. Sync model: webhook + self-sync, layered

Two paths keep the api's local `User` row in lock-step with Clerk. **Both** are needed.

| Event | Source | Updates |
| --- | --- | --- |
| `user.created` | **Not** subscribed — would race with the web's self-sync | — |
| `user.updated` / `user.deleted` | Clerk webhook → `POST /webhooks/clerk` | firstName, lastName, email, imageUrl, deletedAt |
| First authenticated render | Web's `getCurrentSession` → `POST /users/me` | Creates local row + stamps Clerk `publicMetadata.{role,userId}` |

The web's self-sync owns the Clerk BAPI write for role/userId — keeps `CLERK_SECRET_KEY` server-only. The api is the single source of truth for `User` row mutations.

### 7. Routes are unversioned

There is no `/v1/`, `/v2/` prefix. If you ever need to version, add it per-route, not globally. The README, OpenAPI doc, and dev URLs all drop the version.

---

## Auth flow in detail

### Sign-up

```
User clicks "Sign in" → Clerk SignIn component
   ↓
Clerk sign-in (Google, email+password, magic link)
   ↓
Clerk sets the session cookie on :3000
   ↓
Web's (authenticated) layout renders → getCurrentSession() called
   ↓
  Clerk auth() → userId OK
  clerk.users.getUser() → public_metadata
   ↓
  If public_metadata.role missing:
     fetch POST /users/me (api)
       → UserService.syncSelf()
         → creates local User row
         → clerk.users.updateUserMetadata(role=CLIENT, userId=<local id>)
     revalidatePath('/')
     redirect('/dashboard')
   else:
     return UserSession
```

### Authenticated request to api

```
Web fetch → POST /items
   Bearer <Clerk session JWT>
   ↓
api requireAuth middleware
   → verifyToken() from @clerk/backend
     - Signature + exp + iss check (always)
     - authorizedParties check (only if azp claim present)
   → c.set('auth', ClerkAuthContext)
   ↓
itemsAdmin.use('*', requireRole(ADMIN))
   → throws 403 if role !== ADMIN
   ↓
items.openapi(createRoute, handler)
   → handleResult(await service.create(auth, body), c)
```

---

## API surface (overview)

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/health` | public | DB reachable + version info |
| GET | `/` | public | service banner |
| GET | `/openapi.json` | dev only | OpenAPI 3.1 spec |
| GET | `/docs` | dev only | Scalar UI |
| POST | `/webhooks/clerk` | Svix sig | user.updated / user.deleted |
| POST | `/dev/issue-token` | dev only | mint Clerk session JWT by email |
| GET | `/items` | public | paginated list |
| GET | `/items/{id}` | public | get by id |
| POST | `/items` | ADMIN | create |
| PATCH | `/items/{id}` | ADMIN | update |
| DELETE | `/items/{id}` | ADMIN | soft-delete |
| GET | `/users/me` | auth | local DB-backed user row |
| POST | `/users/me` | auth | self-sync (Clerk → DB) |
| POST | `/users` | ADMIN | admin provision + role assign |

---

## Web route groups

```
app/
├── (auth)/                 public sign-in / sign-up (Clerk components)
├── (authenticated)/        any logged-in user — dashboard lives here
├── (admin)/                ADMIN-only — CLIENTs → /auth/error-rol
│   └── admin/page.tsx     → /admin
└── (client)/               CLIENT-only — ADMINs → /dashboard
    └── client/page.tsx    → /client
```

`/(authenticated)` is the default landing for signed-in users; `/(admin)` and `/(client)` are role-specific dashboards. Each group has its own `layout.tsx` that calls `getCurrentSession({ redirectIfNotFound: true })` + role check.

---

## Logging

| Surface | What it logs | Control |
| --- | --- | --- |
| API requests | per-request line (`method path status ms user_id request_id`) | `LOG_LEVEL` |
| API Prisma `error`/`warn` | always | `LOG_LEVEL` |
| API Prisma `query` | optional | `LOG_QUERIES=true` |
| Web (dev) | `import { logger } from '@/lib/logger'` — stdout | NODE_ENV ≠ production |
| Web (prod) | nothing (the dev logger is a no-op) | — |

---

## CI/CD

Four workflows, image-first and branch-aware:

1. **`ci.yml`** — runs on PR to `main`/`test`. Single job: install → lint → typecheck → unit tests → build api → build web. No Postgres, no migrations — those are runtime concerns.
2. **`release-prod.yml`** — runs on push to `main`. Stable channel. Builds per-service prod images (`:stable` + `:<semver>`) using cache `:buildcache`, then curls the prod Dokploy webhook for each.
3. **`release-test.yml`** — runs on push to `test`. Prerelease channel. Same flow, `test` channel.
4. **Migrations** run inside the api container's entrypoint at boot, not in CI.

```
PR opened    → ci.yml (lint/typecheck/test/build)
PR merged into test → release-test.yml (test image + Dokploy webhook test)
PR merged into main → release-prod.yml (prod image + Dokploy webhook prod)
container boot     → apps/api/docker-entrypoint.sh (prisma migrate deploy → node)
```

### Branches + commits

- `main` → every push triggers `release-prod.yml`. Stable releases (`vX.Y.Z`).
- `test` → every push triggers `release-test.yml`. Prereleases (`vX.Y.Z-test.N`).
- `feature/*`, `fix/*`, `chore/*` etc. merge into `test` first, then promote to `main`.
- Conventional commits enforced by CI (`feat:`, `fix:`, `chore:`, `docs:` …).

---

## What's where — reading the codebase

| Want to learn… | Start at |
| --- | --- |
| How an HTTP request is processed | `apps/api/src/index.ts` (boot) → `apps/api/src/features/items/routes.ts` (split router) |
| How auth is verified server-side | `apps/api/src/auth/clerk.ts` (`verifyClerkToken`, `requireAuth`, `attachUserLogger`) + `auth/role.ts` (`requireRole`) |
| How OpenAPI + Scalar docs are wired | `apps/api/src/scalar/auth-guide.ts` + `apps/api/src/openapi/{security,responses}.ts` |
| How Clerk webhook events sync the local DB | `apps/api/src/features/webhooks/{routes,service}.ts` |
| How the frontend reads the role on the client | `apps/web/src/features/auth/role-context.tsx` + `useRole()` hook |
| How a server-component role gate works | `apps/web/src/app/(admin)/layout.tsx` (compare with `(authenticated)/layout.tsx`) |
| How the JWT template claims flow through | Clerk dashboard → JWT template → `apps/api/src/auth/clerk.ts` `rawRole` extraction |
| How pagination metadata is shared | `packages/shared-types/src/cross-cutting/pagination.ts` + `paginationResponseSchema()` factory |

---

## Project status

This is a starter template. Business features are added per-project. The current template ships:

- Hono api with one resource (`items`) demonstrating the full Repository + Service + Result + OpenAPI layering
- Clerk auth wired end-to-end (JWT verify on api, Next.js middleware on web, role-based middleware, self-sync)
- Webhook + self-sync keeping local `User` rows current with Clerk
- Two role-gated route groups (admin / client) with server + client render guards
- Scalar UI at `/docs` with bearer-auth + dev token minting endpoint
- Migration history under `packages/db/prisma/migrations/` (committed)

When you fork: replace `items` with your first domain feature, add the matching `(admin)/<feature>/` + `(client)/<feature>/` route groups, add the corresponding `paginationResponseSchema(yourDto, 'Your')` to your `200` responses. The boilerplate handles itself.
