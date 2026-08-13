---
description: Tree snapshot of web-project-template (current: Node 24, pnpm 11, Hono 4 + Prisma 7 + Next.js 16 + Tailwind v4 + Biome 2.5 + Clerk + Redis 8 + Docker + GH Actions + Dokploy). One User domain only. Cache layer (L1 in-process Map + L2 Redis) for both Clerk BAPI memo and UserSession DTO. Template-only seed wired into the api container boot.
---

# Template tree (current snapshot)

This is the file layout `init-from-template` produces. New features go under `apps/api/src/<feature>/` and `apps/web/src/features/<feature>/`. Schemas + generated types live in `packages/db/`. Auth-gated pages live under `apps/web/src/app/(authenticated)/app/<feature>/` — the `/app` URL prefix is what `proxy.ts` matches.

```
web-project-template/
├── .github/
│   ├── dependabot.yml
│   ├── filters.yml
│   ├── PULL_REQUEST_TEMPLATE.md
│   ├── SECRETS.md                  ← which secrets CI expects (created at fork time)
│   └── workflows/
│       ├── check-branch.yml        ← branch name lint (conventional prefixes, ignores main/test/dev). When the fork picks two-tier or main-only, edit this to drop the `test` allowance.
│       ├── check-pull-request.yml  ← conventional-commits title + commit message validation
│       ├── ci.yml                  ← PR gate: install + lint + check + typecheck + test + build
│       ├── release.prod.yml        ← push to main: stable channel + prod images + Dokploy prod webhooks
│       └── release.test.yml        ← push to test: prerelease channel + test images + Dokploy test webhooks (delete for two-tier / main-only forks)
├── .vscode/
│   ├── settings.json              ← Biome default formatter + format-on-save + ts.tsdk pinned to root
│   └── extensions.json            ← biomejs.biome + tailwind + ts + prisma + playwright; exclude eslint/prettier/fronterior
├── .agents/
│   └── skills/                    ← project-local copies of Claude skills (Clerk family)
├── .containers/                   ← docker volumes (postgres + redis data) — gitignored
├── .gitattributes                 ← force LF across the monorepo (CI/Docker are Linux)
├── .dockerignore                  ← keep build context small
├── apps/
│   ├── api/
│   │   ├── .env                   ← gitignored (mirrors .env.example)
│   │   ├── .env.example           ← includes REDIS_URL; no SEED_ENABLED (seed is template-only)
│   │   ├── Dockerfile             ← 4 stages: deps → build + runtime-deps → runner (slim, no pnpm, no tsx)
│   │   ├── docker-entrypoint.sh   ← migrate deploy → prisma db seed → exec api. Forks delete the seed step before prod.
│   │   ├── package.runtime.json   ← flat manifest for the slim runner (no workspace, no symlinks; pinned exact). Includes both pg and neon adapters + @neondatabase/serverless for adapter auto-detect.
│   │   ├── package.json
│   │   ├── tsconfig.json          ← extends tsconfig.base.json
│   │   ├── tsconfig.build.json    ← TS 6 needs explicit `"rootDir": "./src"` when outDir is set
│   │   ├── vitest.config.ts
│   │   └── src/
│   │       ├── auth/
│   │       │   ├── clerk.ts       ← JWT verify + getClerkUserCached (L1 Map + L2 Redis, 30s TTL) → ClerkAuthContext
│   │       │   └── role.ts        ← requireRole middleware
│   │       ├── cache/             ← cache layer; both modules degrade silently when Redis is unreachable
│   │       │   ├── redis.ts       ← singleton client, lazy connect, no throw on outage
│   │       │   ├── clerk-user.ts  ← L1 Map (FIFO 1000) + L2 Redis for clerkClient.users.getUser
│   │       │   └── user-session.ts← L2 Redis for the /users/me DTO. Invalidated by webhooks + admin create.
│   │       ├── core/
│   │       │   ├── handle.ts      ← Result<T> → Hono Response
│   │       │   └── result.ts      ← ok/err + error factories (errForbidden, errNotFound, errConflict, errUnauthorized, errInternal)
│   │       ├── db/prisma-logging.ts
│   │       ├── dev/               ← dev-only token minting (NEVER in prod)
│   │       ├── env.ts             ← zod-validated runtime config (REDIS_URL included)
│   │       ├── features/
│   │       │   ├── health/        ← /health endpoint (DB status, redis status logged)
│   │       │   ├── users/         ← the ONE feature in this template. syncSelf checks user-session cache first; admin provisioning; deletedAt guard.
│   │       │   └── webhooks/      ← Clerk webhook receiver. Handles user.updated, user.deleted, session.revoked — each invalidates BOTH caches.
│   │       ├── logger.ts          ← pino single source (uses pino-pretty only when NOT production)
│   │       ├── openapi/           ← shared security + responses constants
│   │       ├── types/             ← Hono ContextVariableMap augmentation
│   │       └── index.ts           ← boot: env → request-id → user-logger → access-log → cors → public → business → error handler → serve
│   └── web/
│       ├── .env                   ← gitignored
│       ├── .env.example
│       ├── Dockerfile             ← Next.js standalone, distroless/nodejs24-debian12:nonroot runner
│       ├── next.config.ts
│       ├── package.json
│       ├── postcss.config.mjs
│       ├── proxy.ts               ← clerkMiddleware: PRIVATE_PREFIX='/app' gates auth. Everything else public (incl. /health, /auth/*, /, /api/webhooks).
│       ├── tsconfig.json
│       ├── vitest.config.ts
│       └── src/
│           ├── app/
│           │   ├── (public)/                     ← marketing + auth pages (no Clerk required)
│           │   │   ├── page.tsx                 → /
│           │   │   ├── auth/
│           │   │   │   ├── iniciar-sesion/[[...sign-in]]/page.tsx  → /auth/iniciar-sesion
│           │   │   │   └── registro/[[...sign-up]]/page.tsx        → /auth/registro
│           │   │   └── health/route.ts                            → /health (liveness probe)
│           │   ├── (authenticated)/               ← Clerk-protected. All private routes live under this /app prefix.
│           │   │   ├── layout.tsx                ← auth gate (getCurrentSession + redirect)
│           │   │   └── app/
│           │   │       ├── layout.tsx            ← (shared sub-layout if needed)
│           │   │       ├── dashboard/page.tsx    → /app/dashboard
│           │   │       └── admin/                ← admin role gate
│           │   │           ├── layout.tsx        ← requireRole(ADMIN) → redirects non-admins
│           │   │           └── page.tsx           → /app/admin
│           │   ├── globals.css    ← single source of tokens + base styles
│           │   ├── layout.tsx     ← root: fonts + skip-link + ThemeProvider + Providers + RoleProvider + Navbar
│           │   ├── loading.tsx    ← root suspense skeleton
│           │   ├── not-found.tsx  ← root 404
│           │   ├── page.tsx       ← actual / is inside (public)/page.tsx; this top-level redirect wouldn't normally exist
│           │   ├── providers.tsx  ← 'use client' ClerkProvider (shadcn theme + esES localization)
│           │   └── robots.ts      ← MetadataRoute.Robots — disallows /app/ and /auth/ in prod
│           ├── components/
│           │   ├── layout/{navbar.tsx, theme-toggle.tsx}
│           │   ├── theme-provider.tsx ← next-themes wrapper (class-based dark mode)
│           │   └── ui/             ← shadcn components (excluded from biome formatting)
│           ├── features/
│           │   └── auth/
│           │       ├── actions.ts          ← getCurrentSession (zero-arg readSession memo + thin dispatch) + getCurrentToken. Rung-1 cache fix: cache() keys on arg identity, so the memo MUST be zero-arg.
│           │       ├── constants.ts        ← REDIRECT_URL, FALLBACK_REDIRECT_URL
│           │       ├── guards.tsx          ← <RequireRole>, <IfRole>
│           │       ├── role-context.tsx    ← useRole, useIsAdmin, useIsClient (null-safe for anonymous)
│           │       ├── services/
│           │       │   └── auth.service.ts  ← getOrSyncMyUserSession (api self-syncs the local row from the JWT)
│           │       ├── types.ts            ← UserSession, UserRole re-export
│           │       └── index.ts
│           └── lib/
│               ├── api-client.ts           ← ApiClient + RequestBuilder (single chokepoint, dev logs)
│               ├── env/{client,server}.ts  ← t3-oss/env-nextjs schemas
│               ├── logger.ts               ← dev-only noop
│               ├── safe-action.ts          ← server-action result wrapper
│               ├── next-control-errors.ts  ← isNextControlError helper
│               └── utils.ts
├── packages/
│   ├── db/
│   │   ├── package.json           ← exports: import → dist/, dev → src/. dev: tsc watch. runtime: Prisma 7, @prisma/adapter-pg (docker) or @prisma/adapter-neon (Neon, auto-detect), pg, @neondatabase/serverless.
│   │   ├── tsconfig.json
│   │   ├── tsconfig.build.json    ← tsc → dist/ (rootDir omitted, includes src/ + generated/)
│   │   ├── prisma.config.js       ← Prisma 7: plain JS so slim runner can invoke via node (no tsx). seed: 'node apps/api/dist/seed.js'
│   │   ├── prisma/
│   │   │   ├── schema.prisma      ← provider=prisma-client-js. Single model: User. Replace at fork time.
│   │   │   ├── migrations/
│   │   │   │   └── <timestamp>_init/migration.sql
│   │   │   └── seed.ts           ← TEMPLATE-ONLY: creates admin@template.test on empty DB; idempotent (skips with log if any users exist); try/catch with Clerk rollback on mid-flow failure. Forks DELETE this file.
│   │   └── src/
│   │       ├── client.ts          ← PrismaClient singleton (driver adapter)
│   │       ├── types.ts           ← re-exports Prisma types
│   │       └── index.ts
│   └── shared-types/
│       ├── package.json           ← exports: import → dist/, dev → src/. dev: tsc watch. zod + @hono/zod-openapi (hoisted from api)
│       ├── tsconfig.json
│       ├── tsconfig.build.json
│       └── src/
│           ├── cross-cutting/     ← apiErrorSchema, paginationResponseSchema
│           ├── features/         ← per-domain DTOs (only `user` shipped)
│           └── index.ts
├── docker-compose.yml             ← dev: postgres + redis (host runs api/web via pnpm dev:*)
├── docker-compose.prod.yml        ← prod-like: full stack via local Dockerfiles. NODE_ENV=production hard-pinned for api + web. REDIS_URL hard-pinned to in-container hostname. Redis is a sibling service on the prod bridge network.
├── biome.json                     ← SINGLE source of lint + format for every package
├── pnpm-workspace.yaml            ← workspaces + overrides (utf-8-validate peer fix)
├── pnpm-lock.yaml                 ← single root lockfile (shared-workspace-lockfile=true default)
├── .npmrc                         ← public-hoist-pattern[]=* — root package.json is the single source of shared versions. Both Dockerfiles COPY it so the image's node_modules layout matches local dev.
├── tsconfig.base.json             ← shared TS config (every package extends it)
├── package.json                   ← name, version, description, scripts, engines, deps (zod, @hono/zod-openapi), devDeps (biome, ts, tsx, vitest, @types/node, esbuild)
├── release.config.mjs
├── .editorconfig
├── .env.example                   ← template for compose + Clerk secrets; includes SEED_PASSWORD (template-only, delete the section before forking)
├── .gitignore
├── AGENTS.md                      ← AI-assistant guidance
├── CLAUDE.md                      ← canonical session briefing (layout, commands, gitflow, anti-patterns)
├── CONTRIBUTING.md               ← dev flow + gitflow + conventions (matches the branch-structure answer at init time)
├── README.md                      ← top-level docs (architecture, stack, day-to-day)
└── docs/
    └── architecture.md            ← deep dive per layer
```

## Engine pins (`package.json`)

```json
"engines": {
  "node": ">=24",
  "pnpm": ">=11"
},
"packageManager": "pnpm@11.10.0"
```

## Root devDependencies (hoisted)

```json
"devDependencies": {
  "@biomejs/biome": "2.5.2",
  "@types/node": "^22.0.0",
  "tsx": "^4.23.0",
  "typescript": "^6.0.3",
  "vitest": "^4.1.10"
}
```

Sub-packages must NOT carry their own biome/typescript/tsx/vitest/@types/node. One install at root, one version everywhere.

`esbuild` lives in `apps/api/devDependencies` (used by `apps/api` build script only — not hoisted because no other package needs it).

## Slim runtime model (api)

- `apps/api/Dockerfile` builds the api as a 1.1MB esbuild bundle. The api `build` script also bundles `packages/db/prisma/seed.ts` into `apps/api/dist/seed.js` so the seed can run as `node apps/api/dist/seed.js` (no `tsx` at runtime). Workspace packages `@app/db` and `@app/shared-types` are pre-transpiled to `dist/` in the build stage; their `exports` field maps `import` to `dist/` and `dev` to `src/` (so `pnpm dev` with `tsx --conditions=dev` keeps using source).
- Runner has **no pnpm, no corepack, no pino-pretty, no tsx**. Install is `npm install --omit=dev` from `apps/api/package.runtime.json` (7 deps, pinned exact — keep them in sync with `packages/db` on every Prisma bump). It runs in its own `runtime-deps` stage so its cache key is that manifest alone, not the app source. The seed runs as a bundled JS — workspace deps are inlined by esbuild at build time, so node_modules only needs the runtime npm packages.
- The runner never runs `chown -R /app`: ownership is set inline via `COPY --from=runtime-deps --chown=api:nodejs`, which is free. `node_modules` must be writable by `api` because the prisma CLI does a writability preflight on `@prisma/engines` before every command.
- Only `schema.prisma` + `migrations/` are copied into the image — not the whole `prisma/` dir, which would drag in the unused `seed.ts` source.
- Migration runs via `node node_modules/prisma/build/index.js migrate deploy --schema=… --config=prisma.config.js`.
- Seed runs right after migrate: `node node_modules/prisma/build/index.js db seed --schema=… --config=…` → which internally invokes `node apps/api/dist/seed.js`.
- Image size: ~780 MB. Cold boot to `api listening`: ~2 s.

## Slim runtime model (web)

- `apps/web/Dockerfile` uses **gcr.io/distroless/nodejs24-debian12:nonroot** as the runner base. No shell, no apk. Standalone Next.js output is self-contained; entrypoint is the distroless-inherited `node` with the script as CMD.
- Image size: ~258 MB.

## Cache architecture (api)

- **`apps/api/src/cache/redis.ts`** — lazy-connect singleton (`lazyConnect: true`, `maxRetriesPerRequest: 2`), no throw on outage. Wraps `ioredis` with `redisGet`/`redisSet`/`redisDel`/`redisFlushAll` helpers that return `null`/`false` on failure. We picked `ioredis` over `node-redis` v6 because the latter's generic RESP-version variance is unresolvable — `createClient({url})` infers RESP2; the default-typed alias is RESP3; TS rejects every assign-back. ioredis is a concrete `Redis` class — no generic dance, stable types.
- **`apps/api/src/cache/clerk-user.ts`** — wraps `clerkClient.users.getUser(sub)`. L1 in-process Map (FIFO eviction at 1000, 30 s TTL) + L2 Redis (30 s TTL). Lookup order: L1 → L2 → Clerk BAPI. Key: `${env.NODE_ENV === 'production' ? 'prod' : 'dev'}:clerk:user:v1:${sub}`. Invalidation: `invalidateClerkUserCached(sub)` drops both layers.
- **`apps/api/src/cache/user-session.ts`** — wraps the `/users/me` DTO. L2 Redis only (no L1 — DTO is per-cluster state, sharing is the point). Key: `${env.NODE_ENV}:user:session:v1:${clerkId}`. Invalidation: `invalidateUserSessionCached(clerkId)` (called from webhooks + admin create).
- **Both caches degrade silently** — Redis down → fall back to L1 (clerk-user) or no cache (user-session). Never 5xx on cache failure.
- **Invalidation contract**: every code path that mutates the local `User` row must call BOTH `invalidateUserSessionCached(clerkId)` AND `invalidateClerkUserCached(clerkId)`. Skipping the second creates a 30-60 s window where `syncSelf` re-reads stale `auth.role` from the BAPI memo and overwrites the DB back to the old role.

## Session cache (web)

- **`apps/web/src/features/auth/actions.ts`** — `getCurrentSession` and `getCurrentToken` are thin dispatch functions over zero-arg `readSession` / `readToken` memos. The split is required: React `cache()` keys on arg identity, so passing `{ redirectIfNotFound: ... }` directly to the cached function defeats the memo. Without the split, `/app/admin` does 6 DB queries per render instead of 1.
- The web cache fix is the highest-leverage perf change in the template — no new infra, ~10 lines, 6× reduction in auth-related load.

## Boot-time seed

- `packages/db/prisma/seed.ts` is bundled into `apps/api/dist/seed.js` by the api `build` step (esbuild). The bundled JS runs as `node apps/api/dist/seed.js` from `docker-entrypoint.sh`'s `prisma db seed` step. Gated by the `SEED_ENABLED` env flag (default `true`, hard-pinned in compose).
- **Pure Prisma** — no Clerk BAPI, no external calls. The seed inserts one placeholder `User` row (ADMIN role, sentinel `clerkId`) on an empty DB to validate the write path. Skips with log when any users exist.
- Forks that don't want the seed set `SEED_ENABLED=false` per environment (compose, env). They do NOT delete the file. Documented in the file's header.
- To make the seeded user sign-in-able, the matching Clerk account must be created manually in the Clerk dashboard with the same `clerkId` sentinel. The first `user.created` webhook will populate `privateMetadata.role` from the local row's `role` column.

## How to extend

| To add… | Where |
| --- | --- |
| New model | `packages/db/prisma/schema.prisma`, then `pnpm --filter @app/db migrate:dev` |
| New backend feature | `apps/api/src/<feature>/{repository,service,routes,schemas,mappers,index}.ts` + mount in `src/index.ts`. Repository wraps `database`; service holds `Result<T>`; routes use `handleResult`. |
| New auth-gated page | `apps/web/src/app/(authenticated)/app/<feature>/page.tsx` (or `.../admin/<feature>/page.tsx` if admin-only). URL becomes `/app/<feature>` automatically; no `proxy.ts` edit. |
| New public page | `apps/web/src/app/(public)/<feature>/page.tsx` → `/<feature>`. No `proxy.ts` edit. |
| New shadcn component | `pnpm dlx shadcn@latest add <name>` (writes to `apps/web/src/components/ui/`; root `biome.json` ignores those files via `!**/apps/**/src/components/ui`) |
| New env var | api: `apps/api/.env.example` + `apps/api/src/env.ts`. web: `apps/web/.env.example` + `apps/web/src/lib/env/{client,server}.ts`. root: `.env.example` only if consumed by docker compose. **Never add `NEXT_PUBLIC_API_URL`** — compose hardcodes the in-container URL and `client.ts` provides the dev default. |
| New workflow | `.github/workflows/<name>.yml`; mirror `ci.yml`'s single-job sequential style, no postgres service |
| New GitHub secret | Add to repo Settings → Secrets, then document in `.github/SECRETS.md` |
| New log line (dev only on web) | `import { logger } from '@/lib/logger'` |
| Hoist a dep used by 2+ packages | Add to root `package.json`. Remove from sub-packages. Run `pnpm install` once. |
| New cache layer | `apps/api/src/cache/<name>.ts` — follow the `clerk-user.ts` pattern: lazy singleton client, degrade silently on Redis error, namespace keys by `env.NODE_ENV`, expose `get*Cached()` + `invalidate*Cached()` helpers. |
| Mutate a User row | After the DB write, call `Promise.all([invalidateUserSessionCached(clerkId), invalidateClerkUserCached(clerkId)])`. Missing the second invalidator creates a 30 s role-flip rollback window. |
| Disable the seed in one env | Set `SEED_ENABLED=false` in that environment's compose or env file. The seed file stays in the repo. |
| Extend the seed | Edit `packages/db/prisma/seed.ts`. The api `build` step re-bundles it to `apps/api/dist/seed.js` automatically. Don't add deps to `package.runtime.json` — the bundle inlines them at build time. |

## What you do NOT modify

- `pnpm-workspace.yaml` packages list (unless adding a new app or package).
- The two compose file names (`docker-compose.yml`, `docker-compose.prod.yml`). Renaming breaks the package scripts.
- The five workflow file names. Each one maps to a specific CI surface. (`release.prod.yml` + `release.test.yml` are intentionally separate — don't merge them. Two-tier / main-only forks delete `release.test.yml` and optionally rename `release.prod.yml` → `release.yml`.)
- The gitflow shape for the variant the fork chose at init time. Don't go from `main only` back to three-tier without updating the workflows + CONTRIBUTING.md + filters.yml together.
- Anything already referenced from a secret — credential strings must come from `secrets.*`, never literal.
- `biome.json` at the root — every app extends it. Do not add per-package `biome.json`.
- The `User` model — replace with the real domain at fork time, don't keep both.
- The `NODE_ENV: production` hard-pin in `docker-compose.prod.yml` (api + web services). Letting the dev `.env` leak `NODE_ENV=development` in causes logger.ts to load `pino-pretty`, which is not in the slim image.
- The `REDIS_URL` hard-pin in `docker-compose.prod.yml` (`redis://redis:6379`). Letting a host-side value leak in makes the api look for Redis on `localhost` (wrong, container localhost ≠ host localhost).
- The `package.runtime.json` flat manifest for the api runner. Workspace deps are not honored at runtime — they must be listed here too if their runtime code is invoked. Versions are pinned exact so `npm install` is deterministic.
- The `/app` URL prefix in `proxy.ts` — it's the contract between the convention and the auth gate. Removing it means every new private page requires a `proxy.ts` edit (back to the original foot-gun).
- The zero-arg memo split in `actions.ts` — the split is required for `cache()` to hit. Re-adding the redirect into the cached function defeats the memo.
- The `package.json` `seed` script (`prisma db seed`) — forks delete the seed file, not the script. Renaming the script breaks `pnpm db:seed` from the host.

## What CI does NOT do

- Run a Postgres service. Unit tests are pure.
- Run Redis. Cache behavior is exercised in integration / prod only.
- Run `prisma migrate deploy`. Migrations are applied at container boot by `apps/api/docker-entrypoint.sh`.
- Run `prisma db seed`. Same — only at container boot, only if the DB is empty.
- Run husky/commitlint/lint-staged. Conventional commits enforced by `check-pull-request.yml`; format/fix locally via the Biome VS Code extension (`.vscode/extensions.json`) or `pnpm lint:fix` / `pnpm format`.

## GH Actions version pinning (major-only)

| Workflow step | Pin |
| --- | --- |
| `actions/checkout` | `@v6` |
| `actions/setup-node` | `@v6` |
| `pnpm/action-setup` | `@v6` |
| `dorny/paths-filter` | `@v4` |
| `cycjimmy/semantic-release-action` | `@v6` |
| `docker/setup-buildx-action` | `@v4` |
| `docker/login-action` | `@v4` |
| `docker/build-push-action` | `@v7` |
| `amannn/action-semantic-pull-request` | `@v6` |
| `gsactions/commit-message-checker` | `@v2` |
| `deepakputhraya/action-branch-name` | `@master` |

Keep this convention when forking. Major-only gives free patch upgrades; full SHAs give reproducibility at the cost of maintenance.
