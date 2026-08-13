# web-project-template

Minimal web project template. pnpm workspaces, two deployable apps + two shared packages. **The only domain shipped is `User`** — fork and replace it with your first real feature. Everything around it (auth, db, CI/CD, docker, lint, formatting) is the boilerplate you keep.

---

## TL;DR — first 5 minutes

```bash
# 1. Install + env
pnpm install
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
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
| Package manager | **pnpm 11** (workspaces, root devDependencies hoisted) |
| Backend | **Hono 4** + `@hono/zod-openapi` (typed routes + OpenAPI 3.1) + **Prisma 7** + `@prisma/adapter-pg` + **@clerk/backend** (JWT verify) + pino logger + Result pattern |
| Frontend | **Next.js 16** (app router, Turbopack) + **Tailwind v4** + **Biome** (lint + format) + **shadcn/ui** + **Clerk** + Server Actions |
| Auth | **Clerk** — shared across api (JWT verification) and web (Next.js SDK). Two roles: `ADMIN`, `CLIENT`. |
| API docs | **@scalar/hono-api-reference** — `/docs` page with live Try-It-Out + JWT auth UI |
| Webhooks | **Svix** (Clerk's webhook infra) — verified via `verifyWebhook()` from `@clerk/backend/webhooks` |
| Database | **Postgres 18** (Docker compose for dev + prod) |
| Cache | **Redis 7** (Docker compose) — L2 cache for Clerk BAPI user memo (`apps/api/src/cache/clerk-user.ts`). Optional — api degrades to in-process L1 when Redis is unreachable. |
| CI/CD | **GitHub Actions** (PR gate + per-branch release + Dokploy webhook) |
| Format/lint | **Biome** (single tool, replaces eslint + prettier, one config at root) |

---

## Repo layout

```
.
├── apps/
│   ├── api/                     Hono backend
│   └── web/                     Next.js frontend
├── packages/
│   ├── db/                      Prisma schema + client + migrations
│   └── shared-types/            zod schemas shared across apps
├── biome.json                   SINGLE lint + format config (root)
├── pnpm-workspace.yaml          workspaces + override (utf-8-validate peer fix)
├── pnpm-lock.yaml               single root lockfile
├── tsconfig.base.json           shared TS config (every package extends it)
├── docker-compose.yml           dev (postgres only)
├── docker-compose.prod.yml      prod-like full stack
└── .github/workflows/           ci.yml, check-branch.yml, check-pull-request.yml, release.{prod,test}.yml
```

### Root devDependencies — what lives there and why

`package.json` (root) holds every tool that more than one workspace uses. Sub-packages stay slim (no `biome`, `typescript`, `vitest`, etc. duplicated). The convention:

| Tool | Reason |
| --- | --- |
| `@biomejs/biome` | lint + format for every package — single config at root |
| `typescript` | every package typechecks via `tsc` |
| `@types/node` | shared by api + db + scripts |
| `tsx` | api runs via `node --import tsx`; also db seed + scripts |
| `vitest` | unit tests in api + web |
| `@hono/zod-openapi`, `zod` | used in api routes + shared-types — runtime deps |
| `vitest` | 2 packages (api + web) |

Rule: hoist to root when 2+ packages need it. Runtime deps (`zod`, `@hono/zod-openapi`) go in `dependencies`; dev tools in `devDependencies`. Per-package deps stay when only that package needs them (e.g. `@clerk/nextjs` only in web).

---

## Architecture

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
   │  /users/me  /users (admin)      │  │   → upsert local User   │
   │  /health /docs /openapi.json    │  └─────────────────────────┘
   │  /dev/issue-token (dev only)    │
   └────────┬─────────────────┬──────┘
            │ Prisma 7         │ shared zod schemas
            ▼                  ▼
   ┌─────────────────┐  ┌─────────────────────────────┐
   │   packages/db   │  │     packages/shared-types    │
   │   Prisma schema │  │   cross-cutting/ + features/ │
   │   + client      │  │   - apiError, pagination    │
   │                 │  │   - user (per-domain)       │
   └─────────────────┘  └─────────────────────────────┘
            ▲                  ▲
            │                  │
   ┌────────┴──────────────────┴────────┐
   │            apps/web               │
   │          (Next.js 16)             │
   │  app/                             │
   │   (public)/  - homepage + auth    │
   │   (authenticated)/app/ dashboard  │
   │   (authenticated)/app/admin/ ADMIN│
   │  features/                        │
   │   auth/   getCurrentSession,      │
   │           guards, role context    │
   └───────────────────────────────────┘
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
| Lint + format (read) | `pnpm lint` |
| Lint + format (write) | `pnpm lint:fix` / `pnpm format` |
| Combined lint+format+rules check | `pnpm check` |
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
# 3. Confirm the new file in packages/db/migrations/<timestamp>_your_change_name/migration.sql
# 4. Commit it — every dev / CI / prod pulls the same migration
```

Never `prisma db push` against the prod DB. Always use committed migrations.

### When you add a new env var

Three places, same key, same order:

1. `apps/<app>/src/env.ts` — zod schema with `.default()` or `.min(1)` for required.
2. `apps/<app>/.env.example` — placeholder value + comment.
3. `apps/<app>/.env` — your actual local value (gitignored).

For vars consumed by `docker-compose.prod.yml` add to root `.env` and `.env.example` too. Compose substitutes via `${VAR}`.

After editing, `pnpm typecheck` to confirm `env.<KEY>` is type-safe.

> **Heads-up — `NEXT_PUBLIC_*` and Docker**: `NEXT_PUBLIC_*` is **inlined at build time**, not runtime. Inside Docker, the web bundle must reference the **in-container** api URL (`http://api:8080`), not the host-side `NEXT_PUBLIC_API_URL=http://localhost:4000`. The compose file hardcodes the build ARG to `http://api:8080`; the `client.ts` schema provides the dev-mode default. Don't set `NEXT_PUBLIC_API_URL` in root `.env` for Docker — it'll silently be ignored.

---

## Conventions — read these before writing code

### 1. `@/*` paths everywhere

Cross-feature / cross-module imports use the `@/` alias. Sibling imports within a feature stay relative.

```ts
// ✓ cross-module
import { handleResult } from '@/core/handle';
import { userDtoSchema } from '@app/shared-types';

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
    ├── users/             the one feature in this template
    ├── health/
    └── webhooks/
```

If you're tempted to put feature-specific code in a top-level folder, move it under `features/`. If you're tempted to put infra in a feature, move it up.

### 3. Result<T> for every service method

The api's services never throw. They return `Result<T>` (`ok(value)` or `err(AppError)`). The handler in `core/handle.ts` converts that to a Response.

```ts
async syncSelf(auth: ClerkAuthContext): Promise<Result<UserDto>> {
  try {
    const clerkUser = await this.clerk.users.getUser(auth.userId);
    // ...
    return ok(toUserDto(row));
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
const syncSelfRoute = createRoute({
  method: 'post',
  path: '/me',
  security: bearerSecurity,
  responses: {
    200: { content: { 'application/json': { schema: userDtoSchema } }, description: 'user mirrored' },
    ...authErrorResponses,
    500: { description: 'sync failed' },
  },
});
```

`security` + `responses` constants live in `src/openapi/` so every feature reuses the same shape.

### 5. Auth is layered

Three layers, in order:

| Layer | Lives in | Gates |
| --- | --- | --- |
| **Clerk middleware** (proxy.ts) | `apps/web/src/proxy.ts` | Authenticated? If no → sign-in. |
| **Route layout gate** | `app/(authenticated)/app/admin/layout.tsx` | Correct role? If no → redirect. |
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

### 8. HTTP requests are dev-logged in the web

`ApiClient.execute()` (the single chokepoint for every api call) emits a `logger.debug` line per request (method, path, hasAuth, hasBody, durationMs) and a `logger.warn` on non-2xx. The web logger is dev-only — `noop` in prod. Use it to debug sync/redirect loops during development; the api's pino is the source of truth in prod.

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
Web fetch → POST /users/me
   Bearer <Clerk session JWT>
   ↓
api requireAuth middleware
   → verifyToken() from @clerk/backend
     - Signature + exp + iss check (always)
     - authorizedParties check (only if azp claim present)
   → c.set('auth', ClerkAuthContext)
   ↓
usersAdmin.use('*', requireRole(ADMIN))
   → throws 403 if role !== ADMIN
   ↓
users.openapi(syncSelfRoute, handler)
   → handleResult(await service.syncSelf(auth), c)
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
| GET | `/users/me` | auth | local DB-backed user row |
| POST | `/users/me` | auth | self-sync (Clerk → DB) |
| POST | `/users` | ADMIN | admin provision + role assign |

---

## Web route groups

```
app/
├── (public)/                              public pages — homepage + Clerk sign-in/up
└── (authenticated)/                       any logged-in user — private routes live under /app/*
    ├── layout.tsx                         ← auth gate (redirects on no session)
    └── app/                                ← matches proxy.ts PRIVATE_PREFIX
        ├── dashboard/page.tsx             → /app/dashboard
        └── admin/                          ADMIN-only — non-admins → FALLBACK_REDIRECT_URL
            ├── layout.tsx                 ← admin role gate
            └── page.tsx                    → /app/admin
```

Private-vs-public is path-driven: `proxy.ts` treats anything under `/app` as auth-required; everything else is public. Add a new private page = drop `app/(authenticated)/app/<feature>/page.tsx`, no `proxy.ts` edit needed.

---

## Logging

| Surface | What it logs | Control |
| --- | --- | --- |
| API requests | per-request line (`method path status ms user_id request_id`) | `LOG_LEVEL` |
| API Prisma `error`/`warn` | always | `LOG_LEVEL` |
| API Prisma `query` | optional | `LOG_QUERIES=true` |
| Web (dev) | `import { logger } from '@/lib/logger'` — stdout | NODE_ENV ≠ production |
| Web api-client | per-request (`api:request` / `api:response` / `api:error`) | NODE_ENV ≠ production |
| Web (prod) | nothing (the dev logger is a no-op) | — |

---

## CI/CD

Four workflows, image-first and branch-aware:

1. **`ci.yml`** — runs on PR. Single job: install → lint → check → typecheck → unit tests → build api → build web. No Postgres, no migrations — those are runtime concerns.
2. **`release-prod.yml`** — runs on push to `main`. Stable channel. Builds per-service prod images (`:stable` + `:<semver>`) using cache `:buildcache`, then curls the prod Dokploy webhook for each.
3. **`release-test.yml`** — runs on push to `test`. Prerelease channel. Same flow, `test` channel.
4. **Migrations** run inside the api container's entrypoint at boot, not in CI.

```
PR opened    → ci.yml (lint/check/typecheck/test/build)
PR merged into test → release-test.yml (test image + Dokploy webhook test)
PR merged into main → release-prod.yml (prod image + Dokploy webhook prod)
container boot     → apps/api/docker-entrypoint.sh (prisma migrate deploy → node)
```

### Gitflow — three-tier circular

We use a 3-tier GitFlow with `dev` as the day-to-day integration branch. The cycle:

```
feature/<name> ─┐
fix/<name>     ─┤  ← your work, branches off dev
chore/<name>   ─┤
               │
               ▼ PR (review)
              test   ← features accumulate here, validates in staging
               │
               ▼ periodic release PR (test → main)
              main   ← every push triggers a stable release
               │
               ▼ post-release sync (main → dev)
              dev    ← dev catches up; next cycle starts here
```

| Branch | Role | Push trigger |
| --- | --- | --- |
| `dev` | Day-to-day integration. Features fork from here. | — |
| `test` | Staging. Features PR in here. Validates in the staging environment. | every push → `release-test.yml` (test-channel prerelease) |
| `main` | Production. Stable-channel releases. | every push → `release-prod.yml` (stable release) |

#### The cycle in steps

1. **Branch from `dev`.** `git checkout -b feature/my-change dev`.
2. **PR into `test`.** Open the PR against `test`. Reviewers approve. CI must pass.
3. **Merge → `test`.** Squash + delete branch. The change is now in the staging environment.
4. **Periodic release to `main`.** When `test` is ready to ship, open a PR `test → main`. CI runs again. On merge, `release-prod.yml` publishes `:latest` + `:<semver>` images and curls the prod Dokploy webhook.
5. **Sync `main` back to `dev`.** After step 4, open (or auto-create) a PR `main → dev` to keep the working branch current. This catches the release commits, hotfixes that landed directly on `main`, and any merge commits.

A `feature/*` branch never opens a PR to `main` directly. Hotfixes on `main` get a follow-up `main → dev` sync to land them in the integration branch.

### Conventional commits

- Conventional commits enforced by CI (`feat:`, `fix:`, `chore:`, `docs:` …). Both PR title and every commit message are checked.
- `feat: ...` → minor bump. `fix: ...` → patch. `feat!: ...` or `BREAKING CHANGE:` → major.

---

## Docker

Two compose files:

| File | Use |
| --- | --- |
| `docker-compose.yml` | Dev. Postgres on `:5440` + Redis on `:6379`. Run api + web on host with hot reload. |
| `docker-compose.prod.yml` | Prod-like local validation. Full stack via Dockerfiles. Exposes web on `:3000`, api on `:4000`. Internal Redis on the bridge network. |

### The `NEXT_PUBLIC_API_URL` rule (read this if syncSelf fails in Docker)

`NEXT_PUBLIC_*` is **inlined into the JS bundle at build time**. In Docker, the web container must reference the **in-container** api URL (`http://api:8080`), not the host-side `localhost:4000`. If you forget:

1. Web builds with `NEXT_PUBLIC_API_URL=http://localhost:4000` (from `.env`).
2. Web runs in container, calls `http://localhost:4000` from inside → ECONNREFUSED.
3. SyncSelf fails. `actions.ts` sees null → revokes Clerk session → redirect → loop.

Fix: the compose file hardcodes `NEXT_PUBLIC_API_URL=http://api:8080` as a build ARG. Don't override it from `.env` for Docker.

### Other Docker notes

- `DATABASE_URL` is forced to `postgres:5432` (compose service name) inside the api container — overrides any host-side `localhost:5440`.
- `REDIS_URL` is forced to `redis://redis:6379` inside the api container — same hard-pin pattern.
- `CORS_ORIGIN` defaults to `http://localhost:${WEB_HOST_PORT:-3000}` so it tracks the host-side web port.
- The api runs `pnpm --filter @app/db migrate:deploy` from `docker-entrypoint.sh` before exec'ing the api.

---

## Where to look — reading the codebase

| Want to learn… | Start at |
| --- | --- |
| How an HTTP request is processed | `apps/api/src/index.ts` (boot) → `apps/api/src/features/users/routes.ts` (split router) |
| How auth is verified server-side | `apps/api/src/auth/clerk.ts` (`verifyClerkToken`, `requireAuth`, `attachUserLogger`) + `auth/role.ts` (`requireRole`) |
| How OpenAPI + Scalar docs are wired | `apps/api/src/openapi/{security,responses}.ts` |
| How Clerk webhook events sync the local DB | `apps/api/src/features/webhooks/{routes,service}.ts` |
| How the frontend reads the role on the client | `apps/web/src/features/auth/role-context.tsx` + `useRole()` hook |
| How a server-component role gate works | `apps/web/src/app/(admin)/layout.tsx` (compare with `(authenticated)/layout.tsx`) |
| How the JWT template claims flow through | Clerk dashboard → JWT template → `apps/api/src/auth/clerk.ts` `rawRole` extraction |
| How pagination metadata is shared | `packages/shared-types/src/cross-cutting/pagination.ts` + `paginationResponseSchema()` factory |
| How the web sync self-bootstraps the local User row | `apps/web/src/features/auth/services/auth.service.ts` (`getOrSyncMyUserSession`) + `actions.ts` |

---

## What's shipped vs what you add

This template ships the boilerplate. The only domain entity is **User**. When you fork:

1. **Replace `User` with your domain entity.** Add models to `packages/db/prisma/schema.prisma`, generate a migration, mount routes under `apps/api/src/features/<your-domain>/`.
2. **Add route groups** for the new entity under `apps/web/src/app/(authenticated)/app/<your-domain>/` (or `(authenticated)/app/admin/<your-domain>/` if admin-only).
3. **Wire shared zod DTOs** in `packages/shared-types/src/features/<your-domain>.ts`.
4. **Add per-feature server actions** in `apps/web/src/features/<your-domain>/actions.ts`.

The boilerplate handles itself: auth, dev tools, build pipeline, lint/format, docker, CI/CD.

## Cloudflare Configuration Guide (Next.js & Astro Universal)

---

### 🔐 Critical Prerequisites (Must-Have Settings)

Before applying any rules, verify that the following core settings are active in your Cloudflare dashboard:

#### 1. SSL/TLS Encryption Mode
* **Location:** **Domain -> SSL/TLS -> Overview**
* **Setting:** Set to **`Full (strict)`**
* **Reason:** Ensures secure, end-to-end encrypted traffic between Cloudflare's Edge network and your origin server (Dokploy / VPS).

#### 2. DNS Proxy Status (Orange Cloud)
* **Location:** **Domain -> DNS -> Records**
* **Setting:** Must be **`Proxied`** (Orange Cloud icon) for both `@` (root) and `www` CNAME/A records.
* **Reason:** Cloudflare CDN, Cache Rules, Redirect Rules, and WAF **will NOT work** if records are set to *DNS only* (Gray Cloud).

---

### 🔄 Redirect Rules (WWW to Apex Domain)

Dashboard location: **Domain -> Rules -> Redirect Rules -> Create rule**.

This rule automatically canonicalizes all incoming traffic by redirecting `www.yourdomain.com` to `yourdomain.com` while preserving all full URI paths and query strings.

#### Rule: `Redirect from WWW to Root`
* **Rule name:** `Redirect from WWW to Root`
* **If incoming requests match:** `Wildcard pattern`
* **Request URL:** `https://www.*`
* **Target URL:** `https://${1}`
* **Status code:** `301 - Permanent Redirect`
* **Preserve query string:** Checked ✅
* **Place at:** `First`

---

### ⚡ Cache Rules Setup (Next.js + Astro)

Dashboard location: **Domain -> Caching -> Cache Rules -> Create rule**.

> ⚠️ **CRITICAL:** Rules must be configured strictly in the **numbered order (1 to 4)** from top to bottom. Cloudflare evaluates rules in cascade order.

---

#### [1] Rule 1 — `01 - Bypass auth cookie`
Ensures that any request containing active session cookies (e.g., Clerk) bypasses both CDN and browser cache to protect user data.

* **Rule name:** `01 - Bypass auth cookie`
* **If incoming requests match:** `Custom filter expression`
* **Expression (`Edit expression`):**
  ```http
  http.cookie contains "__session="
  ```
* **Cache eligibility:** `Bypass cache`
* **Browser TTL:** `Bypass cache`

---

#### [2] Rule 2 — `02 - Cache static assets`
Caches immutable JavaScript bundles, CSS, and fonts generated by Next.js (`/_next/static/`) and Astro (`/_astro/`) on the Edge network.

* **Rule name:** `02 - Cache static assets`
* **If incoming requests match:** `Custom filter expression`
* **Expression (`Edit expression`):**
  ```http
  starts_with(http.request.uri.path, "/_next/static/") or starts_with(http.request.uri.path, "/_astro/")
  ```
* **Cache eligibility:** `Eligible for cache`
* **Edge TTL:** `Use cache-control header if present, bypass cache if not`
* **Browser TTL:** `Respect origin TTL`

---

#### [3] Rule 3 — `03 - Cache image optimizer`
Stores images processed by Next.js (`/_next/image`) and Astro (`/_image`) in Cloudflare's Edge network, offloading CPU/memory usage from the origin server.

* **Rule name:** `03 - Cache image optimizer`
* **If incoming requests match:** `Custom filter expression`
* **Expression (`Edit expression`):**
  ```http
  http.request.uri.path eq "/_next/image" or http.request.uri.path eq "/_image"
  ```
* **Cache eligibility:** `Eligible for cache`
* **Edge TTL:** `Ignore cache-control header and use this TTL` → **`1 hour`** (`3600`s)
* **Browser TTL:** `Override origin and use this TTL` → **`5 minutes`** (`300`s)
* **Vary:** `Normalize values (Recommended)`

---

## 🔧 Manual Cache Purges

When you change `next.config.ts` (CSP, COEP, COOP, security headers), or replace Firebase Storage assets, the CDN can keep serving stale responses for up to 5 minutes (the origin `s-maxage`).

**Purge immediately:**

1. Dashboard → **Caching → Configuration → Purge Cache**
2. **Custom Purge** → Type: **Hostname** → enter `resona.yourdomain.com`
3. Click **Purge**

Or via API (scriptable in CI):

```bash
curl -X POST "https://api.cloudflare.com/client/v4/zones/<ZONE_ID>/purge_cache" \
  -H "Authorization: Bearer <API_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"hosts":["resona.yourdomain.com"]}'
```

Where:

* `<ZONE_ID>` — Dashboard → **Overview** → right sidebar → **API** tab
* `<API_TOKEN>` — **My Profile → API Tokens → Create Token** → template *"Edit zone cache purge"*, scope your zone
