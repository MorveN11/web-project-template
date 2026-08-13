# CLAUDE.md — web-project-template

> Canonical briefing for Claude Code sessions in this repo. Read it before touching code.
> Product-specific facts (domain entities, business rules, contacts) belong in a fork's own
> copy of this file — keep this one generic.

## What this repo is

A minimal but complete monorepo template: **Hono + Prisma 7 + Postgres** (api) · **Next.js + shadcn/ui + Clerk** (web) · pnpm workspaces · Biome · Docker · GitHub Actions + Dokploy.

The scaffold ships exactly one domain entity (`User`, synced from Clerk). Forks replace/extend it — they do not keep placeholder features around.

## Layout (where each concern lives)

| Concern | Path | Notes |
|---|---|---|
| Prisma schema | `packages/db/prisma/schema.prisma` | URL in `prisma.config.js`, not in the schema. Runtime uses `@prisma/adapter-pg`. |
| Shared types api↔web | `packages/shared-types/src/` | zod schemas, or `import type { … } from '@app/db'`. |
| API feature (canonical pattern) | `apps/api/src/features/<feature>/{repository,service,routes,schemas,mappers,index}.ts` | Route → Service → Repository. Never skip a layer. |
| Result pattern | `apps/api/src/core/result.ts` + `core/handle.ts` | Services return `Result<T>`, routes map with `handleResult`. |
| Frontend feature | `apps/web/src/features/<feature>/{actions,schemas,types,constants}.ts` + `services/<feature>.service.ts` | Server actions for writes, services for reads. |
| Env — api | `apps/api/src/env.ts` | Only place that reads `process.env`. Fail-fast zod parse. |
| Env — web | `apps/web/src/lib/env/{client,server}.ts` | `NEXT_PUBLIC_*` in client, secrets in server. |
| Auth | `apps/web/src/features/auth/` | `getCurrentSession()` server-side; `useRole()`/`useIsAdmin()` client-side (UI hint only, never a security boundary). |
| Route protection | `apps/web/src/proxy.ts` | Anything under `/app` is private; everything else is public. Add private pages under `app/(authenticated)/app/<feature>/`. |
| Redis cache | `apps/api/src/cache/` | ioredis client (`redis.ts`) namespaced via `${REDIS_KEY_PREFIX}${NODE_ENV}-` (default `web-project-template-<env>-`). L1 in-proc Map + L2 Redis memo around Clerk BAPI. |
| Biome config | `biome.json` (root) | NEVER create a per-package `biome.json`. |
| Lockfile | `pnpm-lock.yaml` (root) | NEVER set `shared-workspace-lockfile: false`. |

More detail: [`AGENTS.md`](AGENTS.md) § "Where to put new code" and [`docs/architecture.md`](docs/architecture.md).

## Commands

```bash
# First-day setup
pnpm install                            # apps/api postinstall runs `prisma generate`
cp .env.example .env && cp apps/api/.env.example apps/api/.env && cp apps/web/.env.example apps/web/.env
# Fill CLERK_SECRET_KEY + CLERK_PUBLISHABLE_KEY in both

# Local DB
pnpm compose                            # postgres on :5440
pnpm db:migrate:dev
pnpm db:seed

# Dev (api + web on the host, postgres in docker)
pnpm dev:api                            # :4000
pnpm dev:web                            # :3000
pnpm dev                                # both

# Verification — all of it must pass before asking for review
pnpm typecheck && pnpm lint && pnpm check && pnpm test && pnpm build

# Prod-like local (full stack in docker)
pnpm compose:prod
```

## Gitflow

```
feature/* ──► dev ──► test ──► main
                       ↑         │
                       └─────────┘ (sync main → dev)
```

`main` = production (release from `test` only) · `test` = staging · `dev` = daily integration, default working branch. Detail: [`CONTRIBUTING.md`](CONTRIBUTING.md) § 2.

Commits are Conventional Commits, enforced by GitHub Actions (not by local hooks). Subject may start with any non-whitespace character.

## GitHub Secrets required before merging to `test`/`main`

`DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`, `DOKPLOY_URL`, `DOKPLOY_DEPLOY_WEBHOOK_{API,WEB}_{PROD,TEST}` (×4), `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `NEXT_PUBLIC_TEST_API_URL`.

Canonical list + descriptions: [`.github/SECRETS.md`](.github/SECRETS.md).

## Before starting a feature task

1. Read [`AGENTS.md`](AGENTS.md) for code conventions and layering.
2. Read [`docs/architecture.md`](docs/architecture.md) if touching package structure or CI/CD.
3. Use `codebase-memory-mcp` before grep (`search_graph` for symbols, `trace_path` for call chains).
4. Run the full verification chain above. If something fails, fix it — do not silence it.

## Anti-patterns (forbidden)

- ❌ Per-package `biome.json`. One at the root.
- ❌ Duplicating hoisted devDependencies (biome, typescript, tsx, vitest, @types/node, zod, `@hono/zod-openapi`) in sub-packages.
- ❌ Runtime `PrismaClient` import in `apps/web`. Type-only imports from `@app/db`.
- ❌ `process.env` outside the official env files.
- ❌ `"typecheck": "echo"` (or any stub) to silence CI.
- ❌ Curling Dokploy webhooks from local scripts. CI is the only thing that triggers redeploys.
- ❌ Editing template infra without being asked (`apps/api/package.runtime.json`, root `biome.json`, both compose files, `.github/workflows/*`).
- ❌ PR from `feature/*` straight into `main`.
- ❌ Real secrets in `.env.example`.
- ❌ `NEXT_PUBLIC_API_URL` in the root `.env` for Docker — the compose file hardcodes `http://api:8080` as a build ARG.

## Notes for forks

- Replace the `User`-only domain with the real entities. Don't reintroduce placeholder features.
- The UI ships `lang="es"` + Spanish auth routes + Clerk `esES` localization. Switch both if the product isn't Spanish.
- **Set `REDIS_KEY_PREFIX` to `<app-name>-`** in `apps/api/.env` (or via Dokploy env injection). Every fork MUST namespace its Redis keys so forks sharing a cluster don't collide. The ioredis `keyPrefix` option reads this env (default `web-project-template-`) AND joins it with `NODE_ENV` so dev/staging/prod are isolated automatically.
- Rename in one pass: `package.json` `name`, both compose `name:` + `POSTGRES_DB` + network names, `.env.example` image names, api `index.ts` service/OpenAPI titles, `docker-compose*.yml` image tags, and the `name:` fields in the release workflow matrices.
