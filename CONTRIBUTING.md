# Contributing

Everything you need to land a change on `web-project-template`. Read this top-to-bottom once; later you can jump straight to the relevant section.

---

## TL;DR

```bash
# Setup
pnpm install
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
pnpm compose            # postgres on :5440
pnpm db:migrate:dev     # apply schema
pnpm dev                # api on :4000, web on :3000

# Day-to-day
git checkout -b feature/my-change test
# ...edit, commit with conventional commits, push
gh pr create --base test
# review + merge → test branch deploys to staging via Dokploy
# promote test → main → prod deploy
```

---

## 1. Setup

### Prereqs

- Node.js ≥ 22
- pnpm ≥ 11 (`corepack enable`)
- Docker (for local postgres via `docker compose`)
- GitHub account with PR access

### Install

```bash
pnpm install
```

This hydrates every workspace (`apps/api`, `apps/web`, `packages/db`, `packages/shared-types`). The api's `postinstall` hook runs `pnpm --filter @app/db generate` so Prisma types are ready.

### Env files

Three files. Each one ships an `.example` version — copy + fill secrets.

| File | Consumed by |
| --- | --- |
| `.env` (root) | `docker compose` (postgres, compose.prod.yml) |
| `apps/api/.env` | tsx (dev), `docker-entrypoint.sh` (prod) |
| `apps/web/.env` | Next.js runtime |

Placeholders to replace before anything runs:

- `CLERK_SECRET_KEY` and `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` — from your Clerk dashboard.
- `DATABASE_URL` — defaults to localhost (matches `pnpm compose`). Update when deploying.

### Local infra

```bash
pnpm compose            # postgres only — host runs api/web with hot reload
pnpm db:migrate:dev      # apply Prisma migrations to local postgres
pnpm dev                 # api + web with hot reload
```

Open http://localhost:3000 (web) and http://localhost:4000/health (api).

To validate the closest-to-production model locally:

```bash
pnpm compose:prod        # full stack via local Dockerfiles
```

---

## 2. Gitflow

We use a simplified Git Flow with two protected branches and Conventional Commits.

```
feature/<name>  ─┐
fix/<name>      ─┤  ← your work
chore/<name>    ─┤
                │
                ▼
              test  ─── push triggers release-test.yml (test channel release + Dokploy)
                │
                ▼ (promote via PR once verified)
              main  ─── push triggers release.prod.yml (stable release + Dokploy)
```

### Branches

| Branch | Role | Lifecycle |
| --- | --- | --- |
| `main` | Production. Stable-channel releases. | Locked, merge only via PR from `test`. |
| `test` | Staging. Prerelease-channel releases. | Default branch for feature work. |
| `feature/*`, `fix/*`, `chore/*`, etc. | Per-change work. | Branch off `test`, PR back into `test`. |

### Branch naming

Conventional prefix + short description:

```
feature/add-product-search
fix/dashboard-redirect-loop
chore/bump-clerk
docs/architecture-diagram
```

Allowed prefixes: `feature`, `fix`, `chore`, `docs`, `feat`, `build`, `ci`, `test`, `refactor`, `perf`, `style`, `dependabot`.

`check-branch.yml` enforces this in CI on every PR.

### Commit messages

[Conventional Commits](https://www.conventionalcommits.org/) required. CI rejects non-conforming titles.

```
feat(api): add item search endpoint
fix(web): hydration mismatch on navbar
chore: bump hono to 4.12
docs: document env vars
```

`check-pull-request.yml` validates both the PR title and every commit message.

---

## 3. PR process

1. **Branch from `test`.** PRs targeting `main` directly are blocked unless cherry-picked.
2. **Open the PR against `test`.** Fill the PR template (Type of change, breaking changes if any, testing notes).
3. **CI runs.** `check-branch`, `check-pull-request`, `ci` must all pass. CODEOWNERS auto-requests review from the appropriate team (`.github/CODEOWNERS`).
4. **Review.** Maintainers / team-reviewers approve.
5. **Merge.** Squash + delete branch.
6. **Promote to `main`.** Open a separate PR: `test → main`. CI runs again, release happens.

### What CI checks

`ci.yml` runs on every PR (any branch):

- `pnpm install --frozen-lockfile`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- Build `apps/api` and `apps/web`

No Postgres service in CI — unit tests are pure. Migrations are runtime concerns (`apps/api/docker-entrypoint.sh`).

### CODEOWNERS — auto-reviewers

```
/.github/                  @maintainers        ← CI/CD changes need a maintainer
/release.config.mjs        @maintainers
/apps/api/                 @backend-reviewers
/packages/db/              @backend-reviewers
/apps/web/                 @frontend-reviewers
/packages/shared-types/    @backend + frontend
```

Admins / maintainers configured in repo settings can bypass CODEOWNERS (Settings → Branches → "Allow specified actors to bypass pull request requirements"). Team members cannot — their PRs require the listed owner's review.

---

## 4. Releases

### Trigger

Releases happen automatically on push:

| Branch | Workflow | Channel | Tags |
| --- | --- | --- | --- |
| `test` | `release.test.yml` | `test` (prerelease) | `:test`, `:<semver>-test` |
| `main` | `release.prod.yml` | `latest` (stable) | `:latest`, `:stable`, `:<semver>` |

Both workflows use `cycjimmy/semantic-release-action@v6` to compute the version. Conventional Commits drive the bump:

- `feat: ...` → minor
- `fix: ...` → patch
- `feat!: ...` or `BREAKING CHANGE:` → major
- `chore:`, `docs:`, etc. → no release (unless pipeline needs it)

### Image namespaces

Images are tagged `<IMAGE_NAMESPACE>/<service>:<tag>`. `IMAGE_NAMESPACE` is a repo variable (Settings → Variables). Falls back to `DOCKERHUB_USERNAME` when unset.

### Deploy

After push to the registry, the workflow curls the corresponding Dokploy webhook. Dokploy pulls the new tag and redeploys the service.

```
release.prod.yml   →  DOKPLOY_DEPLOY_WEBHOOK_{API,WEB}_PROD
release.test.yml   →  DOKPLOY_DEPLOY_WEBHOOK_{API,WEB}_TEST
```

Webhooks live as GitHub Secrets. Configure them in Settings → Secrets before merging to `main` for the first time.

---

## 5. Adding features

### Backend feature (`apps/api/src/<feature>/`)

Each feature follows the same layered pattern:

```
<feature>/
├── repository.ts   ← fluent Prisma facade, owns data shape
├── service.ts      ← business rules + Result<T>
├── routes.ts       ← HTTP boundary: zod + handleResult
├── schemas.ts      ← zod input/output schemas
├── mappers.ts      ← Prisma row → DTO transform
└── index.ts        ← exports the routes
```

Then mount in `apps/api/src/index.ts`:

```ts
app.route('/v1/<feature>', <feature>Routes);
```

### Frontend feature (`apps/web/src/features/<feature>/`)

```
<feature>/
├── actions.ts        ← 'use server' actions, glue auth + service
├── schemas.ts        ← zod schemas (shared with RHF client-side)
├── types.ts          ← types
├── constants.ts      ← feature constants
├── components/       ← UI components
└── services/
    └── <feature>.service.ts  ← fetch wrapper via apiClient
```

### DB model

1. Edit `packages/db/prisma/schema.prisma`.
2. Run `pnpm --filter @app/db migrate:dev -- --name <feature>` to author the migration.
3. Generated client types flow automatically to `apps/api` and `apps/web` via `@app/db` re-exports.

---

## 6. Conventions

### Code style

- Biome is the single tool for format + lint. No eslint, no prettier.
- VS Code's Biome extension (`.vscode/extensions.json`) auto-formats on save.
- Manual: `pnpm lint:fix`.

### Imports

- `import type { X }` for type-only — keeps types out of bundles.
- Group: external → `@/internal` → relative. Biome sorts automatically.

### Logging

- Backend: `apps/api/src/logger.ts` (pino). Use `logger.info/warn/error/debug`. The middleware auto-attaches `request_id` and (for `/v1/*`) `user_id`.
- Frontend: `apps/web/src/lib/logger.ts`. **Dev-only** — no-op in prod builds. Don't use for analytics.

### Env vars

- Add to `apps/api/.env.example` + `apps/api/src/env.ts` (zod schema).
- Add to `apps/web/.env.example` + `apps/web/src/lib/env/{client,server}.ts`.
- Add to root `.env.example` only if consumed by docker compose.
- Test-env deploy vars go in GitHub Secrets (see `.github/SECRETS.md`).
- Never use `process.env.X` outside the env files.

---

## 7. Common tasks

### Add a dependency

```bash
pnpm --filter @app/api add <pkg>          # runtime
pnpm --filter @app/api add -D <pkg>       # dev
# Always commit package.json AND pnpm-lock.yaml together.
```

If the package compiles native code on install (e.g. sharp, prisma engines), add it to `pnpm-workspace.yaml` `onlyBuiltDependencies`.

### Add a shadcn component

```bash
cd apps/web
pnpm dlx shadcn@latest add <component>
```

Components land in `apps/web/src/components/ui/`. Biome is configured to skip formatting those files (they ship ready-made).

### Reset the local DB

```bash
pnpm compose:down
rm -rf .containers/postgres
pnpm compose
pnpm db:migrate:dev
```

### Inspect Prisma Studio

```bash
pnpm db:studio
# http://localhost:5555
```

---

## 8. Where to ask

- Architecture / layering questions → `docs/architecture.md`
- Env / secrets questions → `.github/SECRETS.md`
- Branch protection / release channel questions → this file
- Bugs / specific PR review → GitHub Issues / PRs