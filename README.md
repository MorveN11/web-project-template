# web-project-template

Minimal web project template. pnpm workspaces, two deployable apps + one shared Prisma package. Use as a starting point for any web project — extend with features as the project grows (modules, microservices split, etc.).

## Stack

| Layer | Tech |
| --- | --- |
| Package manager | pnpm 10 (workspaces) |
| Backend | Hono 4 + zod validation + Prisma 7 (Postgres via `@prisma/adapter-pg`) + Clerk JWT + pino logger + Result pattern |
| Database schema | `packages/db` — shared, exports `@app/db` (PrismaClient + types) |
| Frontend | Next.js 15 (app router) + Tailwind v4 + Biome + shadcn/ui + Clerk + Server Actions |
| Auth | Clerk (shared: api verifies JWT, web uses `@clerk/nextjs` + server actions) |
| Infra | Docker Compose (`dev` dbs-only, `prod` full stack) |
| CI/CD | GitHub Actions (PR gate + image build/push + Dokploy webhook) |
| Format/lint | Biome (single tool, replaces eslint + prettier) |

## Layout

```
.
├── apps/
│   ├── api/                     Hono backend (repository + service + Result<T>)
│   └── web/                     Next.js frontend (server actions + dev-only logger)
├── packages/
│   ├── db/                      Prisma schema + generated types + PrismaClient
│   └── shared-types/            zod schemas shared across apps
├── docker-compose.yml           postgres only (host runs api/web with hot reload)
├── docker-compose.prod.yml      full stack (prod-like local validation)
├── .env.example                 local development
├── .vscode/                     Biome-on-save + extension recommendations
└── .github/workflows/           branch + PR lint + ci + release
```

## Quickstart (local)

```bash
pnpm install
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
# fill in Clerk keys in apps/*/.env

pnpm compose             # postgres only
pnpm db:migrate:dev      # apply migrations
pnpm dev                 # api + web with hot reload
```

Open http://localhost:3000 (web). Api health at http://localhost:4000/health.

Validate prod-like locally:

```bash
pnpm compose:prod        # full stack via local Dockerfiles
```

## Branches

- `main` → every push triggers `release.prod.yml`. Stable-channel release (`vX.Y.Z`). Prod images + Dokploy prod webhooks.
- `test` → every push triggers `release.test.yml`. Prerelease-channel release (`vX.Y.Z-test.N`). Test images + Dokploy test webhooks.
- `feature/*`, `fix/*`, `chore/*` etc. merge into `test` first via PR, then promote to `main` once verified.

## Commits

Conventional commits enforced by GitHub Actions (CI). Format/fix locally via the Biome VS Code extension (recommended in `.vscode/extensions.json`) or `pnpm lint:fix`.

```
feat(api): add product search endpoint
fix(web): hydration mismatch on navbar
chore: bump hono to 4.12
docs: document env vars
```

## How CI/CD works

Four workflows, image-first and branch-aware:

1. **PR gates** — `ci.yml` runs on PR to `main`/`test`. Single job: install → lint → typecheck → unit tests → build api → build web. No Postgres service, no migrations — those are runtime concerns. Companion files `check-branch.yml` + `check-pull-request.yml` enforce branch-name + commit-message conventions.
2. **`release.prod.yml`** — runs on push to `main`. Stable channel. Builds per-service prod images (`:stable` + `:<semver>`) using cache `:buildcache`, then curls the prod Dokploy webhook for each.
3. **`release.test.yml`** — runs on push to `test`. Prerelease channel. Builds per-service test images (`:test` + `:<semver>-test`) using cache `:buildcache-test`, then curls the test Dokploy webhook for each.
4. **Migrations** run inside the api container's entrypoint at boot, not in CI.

```
PR opened → check-branch + check-pull-request + ci (lint/typecheck/test/build)
PR merged into test → release.test.yml (test image + Dokploy webhook test)
PR merged into main → release.prod.yml (prod image + Dokploy webhook prod)
container boot → apps/api/docker-entrypoint.sh (prisma migrate deploy → node)
```

## Logging

| Surface | What it logs | Control |
| --- | --- | --- |
| API requests | per-request line (`method path status ms user_id request_id`) | `LOG_LEVEL` |
| API Prisma `error`/`warn` | always | `LOG_LEVEL` |
| API Prisma `query` | optional | `LOG_QUERIES=true` |
| Web (dev only) | `import { logger } from '@/lib/logger'` | dev; no-op in prod |
| Web (prod) | nothing | — |

## Project status

This is a template — no business logic yet. The Hono api exposes `/health` and one placeholder resource (`items`) demonstrating the Repository + Service + Result<T> layering. The Next.js web app exposes a Clerk-protected `/dashboard` placeholder.
