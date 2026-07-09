---
description: Tree snapshot of the web-project-template (v4: Hono 4 + Prisma 7 + Next.js 15 + Tailwind v4 + Biome 2.5 + shadcn + Clerk + Docker + GH Actions + Dokploy).
---

# Template tree (v4 snapshot)

This is the file layout `init-from-template` produces. New features go under `apps/api/src/<feature>/` and `apps/web/src/features/<feature>/`. Schemas + generated types live in `packages/db/`.

```
web-project-template/
├── .github/
│   ├── dependabot.yml
│   ├── filters.yml
│   ├── PULL_REQUEST_TEMPLATE.md
│   ├── SECRETS.md            ← which secrets CI expects
│   └── workflows/
│       ├── check-branch.yml        ← branch name lint (conventional prefixes)
│       ├── check-pull-request.yml
│       ├── ci.yml                  ← PR gates: install + lint + typecheck + test + build
│       ├── release.prod.yml        ← push to main: stable channel + prod images + Dokploy prod webhooks
│       └── release.test.yml        ← push to test: prerelease channel + test images + Dokploy test webhooks
├── .vscode/
│   ├── settings.json            ← Biome default formatter + format-on-save + safe-fix-on-save
│   └── extensions.json           ← biome + tailwind + ts + prisma + playwright, exclude eslint/prettier
├── .gitattributes              # force LF across the monorepo (CI/Docker are Linux)
├── .npmrc                      # shared-workspace-lockfile=false
├── apps/
│   ├── api/
│   │   ├── .dockerignore
│   │   ├── .env.example
│   │   ├── Dockerfile
│   │   ├── biome.json
│   │   ├── docker-entrypoint.sh        ← runs `prisma migrate deploy` here, NOT in CI
│   │   ├── package.json
│   │   ├── tsconfig.build.json
│   │   ├── tsconfig.json
│   │   ├── vitest.config.ts
│   │   └── src/
│   │       ├── auth/clerk.ts
│   │       ├── core/{handle.ts, result.ts}
│   │       ├── db/prisma-logging.ts
│   │       ├── env.ts
│   │       ├── health/routes.ts
│   │       ├── items/{index, schemas, repository, service, routes, mappers}.ts
│   │       ├── logger.ts
│   │       └── index.ts
│   │   └── src/types/hono-context.ts   ← Hono ContextVariableMap augmentation
│   └── web/
│       ├── .dockerignore
│       ├── .env.example
│       ├── .gitignore
│       ├── Dockerfile
│       ├── biome.json
│       ├── components.json
│       ├── next.config.ts
│       ├── package.json
│       ├── postcss.config.mjs
│       ├── proxy.ts
│       ├── tsconfig.json
│       ├── vitest.config.ts
│       └── src/
│           ├── app/
│           │   ├── (authenticated)/{dashboard/page.tsx, layout.tsx}
│           │   ├── auth/{sign-in, sign-up}/[[...catch-all]]/page.tsx
│           │   ├── globals.css
│           │   ├── layout.tsx
│           │   ├── page.tsx
│           │   └── providers.tsx
│           ├── components/{layout/navbar.tsx, ui/button.tsx}
│           ├── features/profile/{actions, constants, schemas, services/profile.service, types}.ts
│           └── lib/{api-client.ts, env/{client,server}.ts, logger.ts, safe-action.ts, utils.ts}
├── packages/
│   ├── db/
│   │   ├── README.md
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── prisma.config.ts   ← Prisma 7: adapter URL lives here
│   │   ├── prisma/{schema.prisma, seed.ts}
│   │   └── src/{client.ts, types.ts, index.ts}
│   └── shared-types/
│       ├── package.json
│       ├── src/index.ts
│       └── tsconfig.json
├── docker-compose.yml         # postgres only — host runs api/web with hot reload
├── docker-compose.prod.yml    # full stack — production-like local validation
├── biome.json                 # single source of formatter + linter rules for both apps
├── pnpm-workspace.yaml
├── release.config.mjs
├── tsconfig.base.json
├── .editorconfig
├── .env.example
└── .gitignore
```

## How to extend

| To add… | Where |
| --- | --- |
| New model | `packages/db/prisma/schema.prisma`, then `pnpm --filter @app/db migrate:dev` |
| New backend feature | `apps/api/src/<feature>/{repository,service,routes,schemas,mappers,index}.ts` + mount in `src/index.ts`. Repository wraps `database`; service holds `Result<T>`; routes use `handleResult`. |
| New protected page | `apps/web/src/app/(authenticated)/<page>/page.tsx` |
| New shadcn component | `pnpm dlx shadcn@latest add <name>` (writes to `apps/web/src/components/ui/`; `biome.json` ignores those files from formatting) |
| New env var | api: `apps/api/.env.example` + `apps/api/src/env.ts`. web: `apps/web/.env.example` + `apps/web/src/lib/env/{client,server}.ts`. root: `.env.example`. Test-env deploy vars are GH secrets (see `.github/SECRETS.md`). |
| New workflow | `.github/workflows/<name>.yml`; mirror `ci.yml`'s single-job sequential style, no postgres service |
| New GitHub secret | Add to repo Settings → Secrets, then document in `.github/SECRETS.md` |
| New log line (dev only on web) | `import { logger } from '@/lib/logger'` |

## What you do NOT modify

- `pnpm-workspace.yaml` packages list (unless adding a new app or package).
- The two compose file names (`docker-compose.yml`, `docker-compose.prod.yml`). Renaming breaks the package scripts.
- The five workflow file names. Each one maps to a specific CI surface. (`release.prod.yml` + `release.test.yml` are intentionally separate — don't merge them.)
- Anything already referenced from a secret — credential strings must come from `secrets.*`, never literal.
- `biome.json` at the root — every app extends it. Add per-app rules under `apps/<name>/biome.json` only when you need app-specific overrides.

## What CI does NOT do

- Run a Postgres service. Unit tests are pure (`src/shared/__tests__/*`).
- Run `prisma migrate deploy`. Migrations are applied at container boot by `apps/api/docker-entrypoint.sh`. If you add integration tests later, set them up against `pnpm compose` (local) or a Dokploy-managed test branch (CI).
- Run husky/commitlint/lint-staged. Conventional commits enforced by `check-pull-request.yml`; format/fix locally via the Biome VS Code extension (`.vscode/extensions.json`) or `pnpm lint:fix`.