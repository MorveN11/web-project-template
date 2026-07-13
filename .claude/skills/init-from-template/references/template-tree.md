---
description: Tree snapshot of web-project-template (current: Node 24, pnpm 11, Hono 4 + Prisma 7 + Next.js 16 + Tailwind v4 + Biome 2.5 + Clerk + Docker + GH Actions + Dokploy). One User domain only. Slim distroless web + slim esbuild api.
---

# Template tree (current snapshot)

This is the file layout `init-from-template` produces. New features go under `apps/api/src/<feature>/` and `apps/web/src/features/<feature>/`. Schemas + generated types live in `packages/db/`.

```
web-project-template/
├── .github/
│   ├── dependabot.yml
│   ├── filters.yml
│   ├── PULL_REQUEST_TEMPLATE.md
│   ├── SECRETS.md                  ← which secrets CI expects (created at fork time)
│   └── workflows/
│       ├── check-branch.yml        ← branch name lint (conventional prefixes, ignores main/test/dev)
│       ├── check-pull-request.yml  ← conventional-commits title + commit message validation
│       ├── ci.yml                  ← PR gate: install + lint + check + typecheck + test + build
│       ├── release.prod.yml        ← push to main: stable channel + prod images + Dokploy prod webhooks
│       └── release.test.yml        ← push to test: prerelease channel + test images + Dokploy test webhooks
├── .vscode/
│   ├── settings.json              ← Biome default formatter + format-on-save + ts.tsdk pinned to root
│   └── extensions.json            ← biomejs.biome + tailwind + ts + prisma + playwright; exclude eslint/prettier/fronterior
├── .agents/
│   └── skills/                    ← project-local copies of Claude skills (Clerk family)
├── .containers/                   ← docker volumes (postgres data) — gitignored
├── .gitattributes                 ← force LF across the monorepo (CI/Docker are Linux)
├── .dockerignore                  ← keep build context small
├── apps/
│   ├── api/
│   │   ├── .dockerignore
│   │   ├── .env                   ← gitignored (mirrors .env.example)
│   │   ├── .env.example           ← no SEED_ENABLED; seed is host-only (pnpm db:seed)
│   │   ├── Dockerfile             ← 4 stages: deps → build → runner (slim, no pnpm, no tsx in runtime)
│   │   ├── docker-entrypoint.sh   ← `node node_modules/prisma/build/index.js migrate deploy` then exec api
│   │   ├── package.runtime.json   ← flat 6-dep manifest for the slim runner (no workspace, no symlinks)
│   │   ├── package.json
│   │   ├── tsconfig.json          ← extends tsconfig.base.json
│   │   ├── tsconfig.build.json    ← TS 6 needs explicit `"rootDir": "./src"` when outDir is set
│   │   ├── vitest.config.ts
│   │   └── src/
│   │       ├── auth/
│   │       │   ├── clerk.ts       ← JWT verify, requireAuth, attachUserLogger
│   │       │   └── role.ts        ← requireRole middleware
│   │       ├── core/
│   │       │   ├── handle.ts      ← Result<T> → Hono Response
│   │       │   └── result.ts      ← ok/err + error factories
│   │       ├── db/prisma-logging.ts
│   │       ├── dev/               ← dev-only token minting (NEVER in prod)
│   │       ├── env.ts             ← zod-validated runtime config (no SEED_ENABLED)
│   │       ├── features/
│   │       │   ├── health/        ← /health endpoint
│   │       │   ├── users/         ← the ONE feature in this template (syncSelf, admin provisioning)
│   │       │   └── webhooks/      ← Clerk webhook receiver (Svix signature verify)
│   │       ├── logger.ts          ← pino single source (uses pino-pretty only when NOT production)
│   │       ├── openapi/           ← shared security + responses constants
│   │       ├── types/             ← Hono ContextVariableMap augmentation
│   │       └── index.ts           ← boot: middleware → routes → error handler → serve
│   └── web/
│       ├── .dockerignore
│       ├── .env                   ← gitignored
│       ├── .env.example
│       ├── Dockerfile             ← Next.js standalone, distroless/nodejs24-debian12:nonroot runner
│       ├── next.config.ts
│       ├── package.json
│       ├── postcss.config.mjs
│       ├── proxy.ts               ← clerkMiddleware gate
│       ├── tsconfig.json
│       ├── vitest.config.ts
│       └── src/
│           ├── app/
│           │   ├── (auth)/
│           │   │   ├── iniciar-sesion/[[...sign-in]]/page.tsx
│           │   │   ├── registro/[[...sign-up]]/page.tsx
│           │   │   └── error-rol/page.tsx
│           │   ├── (authenticated)/{dashboard, layout}.tsx
│           │   ├── (admin)/{admin/page.tsx, layout.tsx}
│           │   ├── (client)/{client/page.tsx, layout.tsx}
│           │   ├── globals.css    ← single source of tokens + base styles
│           │   ├── layout.tsx     ← root: fonts + Navbar + Providers + RoleProvider
│           │   ├── page.tsx
│           │   └── providers.tsx  ← 'use client' ClerkProvider wrapper + <AuthStateSync/>
│           ├── components/
│           │   ├── layout/navbar.tsx
│           │   └── ui/             ← shadcn components (excluded from biome formatting)
│           ├── features/
│           │   └── auth/
│           │       ├── actions.ts          ← getCurrentSession, getCurrentToken
│           │       ├── auth-state-sync.tsx ← 'use client' router.refresh() on isSignedIn flip
│           │       ├── constants.ts        ← REDIRECT_URL, FALLBACK_REDIRECT_URL
│           │       ├── guards.tsx          ← <RequireRole>, <IfRole>
│           │       ├── role-context.tsx    ← useRole, useIsAdmin, useIsClient
│           │       ├── services/
│           │       │   └── auth.service.ts  ← getOrSyncMyUserSession (404 → sync retry)
│           │       ├── types.ts            ← UserSession, UserRole re-export
│           │       └── index.ts
│           └── lib/
│               ├── api-client.ts           ← ApiClient + RequestBuilder (single chokepoint, dev logs)
│               ├── env/{client,server}.ts  ← t3-oss/env-nextjs schemas
│               ├── logger.ts               ← dev-only noop
│               ├── safe-action.ts          ← server-action result wrapper
│               └── utils.ts
├── packages/
│   ├── db/
│   │   ├── package.json           ← exports: import → dist/, dev → src/. dev: tsc watch. runtime: Prisma 7, @prisma/adapter-pg, pg.
│   │   ├── tsconfig.json
│   │   ├── tsconfig.build.json    ← tsc → dist/ (rootDir omitted, includes src/ + generated/)
│   │   ├── prisma.config.js       ← Prisma 7: plain JS so slim runner can invoke via node (no tsx)
│   │   ├── prisma/
│   │   │   ├── schema.prisma      ← provider=prisma-client-js. Single model: User. Replace at fork time.
│   │   │   ├── migrations/
│   │   │   │   └── <timestamp>_init/migration.sql
│   │   │   └── seed.ts
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
├── docker-compose.yml             ← dev: postgres only (host runs api/web)
├── docker-compose.prod.yml        ← prod-like: full stack via local Dockerfiles. NODE_ENV=production hard-pinned.
├── biome.json                     ← SINGLE source of lint + format for every package
├── pnpm-workspace.yaml            ← workspaces + overrides (utf-8-validate peer fix)
├── pnpm-lock.yaml                 ← single root lockfile (shared-workspace-lockfile=true default)
├── tsconfig.base.json             ← shared TS config (every package extends it)
├── package.json                   ← name, version, description, scripts, engines, deps (zod, @hono/zod-openapi), devDeps (biome, ts, tsx, vitest, @types/node, esbuild)
├── release.config.mjs
├── .editorconfig
├── .env.example                   ← template for compose + Clerk secrets (no SEED_ENABLED)
├── .gitignore
├── AGENTS.md                      ← AI-assistant guidance
├── CONTRIBUTING.md               ← dev flow + gitflow + conventions
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

- `apps/api/Dockerfile` builds the api as a 1.1MB esbuild bundle (no tsx at runtime). Workspace packages `@app/db` and `@app/shared-types` are pre-transpiled to `dist/` in the build stage; their `exports` field maps `import` to `dist/` and `dev` to `src/` (so `pnpm dev` with `tsx --conditions=dev` keeps using source).
- Runner has **no pnpm, no corepack, no tsx, no pino-pretty**. Install is `npm install --omit=dev` from `apps/api/package.runtime.json` (6 deps). Migration runs via `node node_modules/prisma/build/index.js migrate deploy --schema=… --config=prisma.config.js`.
- Image size: **1.15GB** (was 1.84GB). Cold boot to `api listening`: **~2s** (was 5s).

## Slim runtime model (web)

- `apps/web/Dockerfile` uses **gcr.io/distroless/nodejs24-debian12:nonroot** as the runner base. No shell, no apk. Standalone Next.js output is self-contained; entrypoint is the distroless-inherited `node` with the script as CMD.
- Image size: **258MB** (was 286MB on alpine).

## How to extend

| To add… | Where |
| --- | --- |
| New model | `packages/db/prisma/schema.prisma`, then `pnpm --filter @app/db migrate:dev` |
| New backend feature | `apps/api/src/<feature>/{repository,service,routes,schemas,mappers,index}.ts` + mount in `src/index.ts`. Repository wraps `database`; service holds `Result<T>`; routes use `handleResult`. |
| New protected page | `apps/web/src/app/(authenticated)/<page>/page.tsx` (or `(admin)/` or `(client)/`) |
| New shadcn component | `pnpm dlx shadcn@latest add <name>` (writes to `apps/web/src/components/ui/`; root `biome.json` ignores those files via `!**/apps/**/src/components/ui`) |
| New env var | api: `apps/api/.env.example` + `apps/api/src/env.ts`. web: `apps/web/.env.example` + `apps/web/src/lib/env/{client,server}.ts`. root: `.env.example` only if consumed by docker compose. **Never add `NEXT_PUBLIC_API_URL`** — compose hardcodes the in-container URL and `client.ts` provides the dev default. |
| New workflow | `.github/workflows/<name>.yml`; mirror `ci.yml`'s single-job sequential style, no postgres service |
| New GitHub secret | Add to repo Settings → Secrets, then document in `.github/SECRETS.md` |
| New log line (dev only on web) | `import { logger } from '@/lib/logger'` |
| Hoist a dep used by 2+ packages | Add to root `package.json`. Remove from sub-packages. Run `pnpm install` once. |
| Seed the dev DB | `pnpm db:seed` (host only — NOT run in any docker entrypoint) |

## What you do NOT modify

- `pnpm-workspace.yaml` packages list (unless adding a new app or package).
- The two compose file names (`docker-compose.yml`, `docker-compose.prod.yml`). Renaming breaks the package scripts.
- The five workflow file names. Each one maps to a specific CI surface. (`release.prod.yml` + `release.test.yml` are intentionally separate — don't merge them.)
- The 3-tier gitflow (`feature → dev → test → main → dev`). Do not PR `feature/*` directly to `main`.
- Anything already referenced from a secret — credential strings must come from `secrets.*`, never literal.
- `biome.json` at the root — every app extends it. Do not add per-package `biome.json`.
- The `User` model — replace with the real domain at fork time, don't keep both.
- The `NODE_ENV: production` hard-pin in `docker-compose.prod.yml` (api + web services). Letting the dev `.env` leak `NODE_ENV=development` in causes logger.ts to load `pino-pretty`, which is not in the slim image.
- The `package.runtime.json` flat manifest for the api runner. Workspace deps are not honored at runtime — they must be listed here too if their runtime code is invoked.

## What CI does NOT do

- Run a Postgres service. Unit tests are pure.
- Run `prisma migrate deploy`. Migrations are applied at container boot by `apps/api/docker-entrypoint.sh`.
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
