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
git checkout dev && git pull
git checkout -b feature/my-change dev
# PR feature → test (review)
# periodic release test → main
# sync main → dev
# ...edit, commit with conventional commits, push
gh pr create --base test
# review + merge → test branch deploys to testing via Dokploy
# promote test → main → prod deploy
```

---

## 1. Setup

### Prereqs

- Node.js ≥ 24
- pnpm ≥ 11 (`corepack enable`)
- Docker (for local postgres via `docker compose`)
- GitHub account with PR access

### Install

```bash
pnpm install
```

This hydrates every workspace (`apps/api`, `apps/web`, `packages/db`, `packages/shared-types`). Root devDependencies (biome, typescript, vitest, tsx, @types/node) are hoisted to `/app/node_modules` so a single install covers every package. The api's `postinstall` hook runs `pnpm --filter @app/db generate` so Prisma types are ready.

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

### Production database (Neon)

For Neon deployments, set `DATABASE_URL` to the `-pooler` endpoint and
`DIRECT_URL` to the direct (non-pooler) endpoint. `prisma migrate` uses
`DIRECT_URL` because the pooler rejects DDL transactions. Docker dev leaves
`DIRECT_URL` empty — `packages/db/prisma.config.js` falls back to `DATABASE_URL`.
The runtime adapter (`@prisma/adapter-neon`) auto-selects when `DATABASE_URL`
matches `.neon.tech` or `-pooler.`; otherwise the local `@prisma/adapter-pg`
path runs unchanged.

> `NEXT_PUBLIC_API_URL` is intentionally **not** in root `.env` (the compose file hardcodes the in-container URL for Docker). `apps/web/src/lib/env/client.ts` provides the dev default. Override in `apps/web/.env` only if your local api runs on a different port.

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

### Repo settings (one-time, after fork)

In **Settings → General → Pull Requests**, configure the merge strategy so Conventional Commits validation stays enforceable end-to-end:

| Setting | Required value | Why |
| --- | --- | --- |
| **Allow merge commits** | OFF | Merging produces "Merge branch 'X' into Y" commits. These fail `gsactions/commit-message-checker`'s regex (no `type(scope):` prefix). Disabling them keeps the history Conventional-Commits-pure. |
| **Allow squash merging** | ON (default commit message = PR title) | Squash collapses the PR into a single commit whose subject is the PR title — which is already validated by `amannn/action-semantic-pull-request`. |
| **Allow rebase merging** | ON (optional) | Linear history, no merge commit. |
| **Always suggest updating pull request branches** | ON | Keeps feature branches current. |
| **Automatically delete head branches** | ON | Cleanup after merge. |

The workflow `check-pull-request.yml` uses `gsactions/commit-message-checker@v2`'s `excludeTitle: '^Merge\b'` to skip any merge commits that slip through. With the merge strategy set as above, no merge commits exist and the `excludeTitle` is a defense-in-depth net, not a workaround.

---

## 2. Gitflow

We use a 3-tier GitFlow. `dev` is the day-to-day integration branch — features fork from it, then PR into `test`, then periodic release to `main`, then `main` syncs back to `dev`.

```
feature/<name>  ─┐
fix/<name>      ─┤  ← your work
chore/<name>    ─┤
                │
                ▼ fork
              dev   ──── day-to-day integration, no push trigger
                │
                ▼ PR (review)
              test   ──── push triggers release-test.yml (test channel release + Dokploy)
                │
                ▼ release PR (test → main)
              main   ──── push triggers release-prod.yml (stable release + Dokploy)
                │
                ▼ sync PR (main → dev)
              dev    ──── dev catches up; cycle restarts
```

### Branches

| Branch | Role | Push trigger | Locked? |
| --- | --- | --- | --- |
| `main` | Production. Stable-channel releases. | `release-prod.yml` | yes — merge only via PR from `test` |
| `test` | Testing. Prerelease-channel releases. | `release-test.yml` | yes — merge only via PR from feature branches or from `main` (sync) |
| `dev` | Day-to-day integration. Features fork from here. | — | no — direct push allowed for trivial sync merges |
| `feature/*`, `fix/*`, `chore/*`, etc. | Per-change work. | — | no — short-lived |

### Branch naming

Conventional prefix + short description:

```
feature/add-product-search
fix/dashboard-redirect-loop
chore/bump-clerk
docs/architecture-diagram
```

Allowed prefixes: `feature`, `fix`, `chore`, `docs`, `feat`, `build`, `ci`, `test`, `refactor`, `perf`, `style`, `dependabot`.

`check-branch.yml` enforces this in CI on every PR. It ignores `main`, `test`, and `dev` (the protected integration branches).

### Commit messages

[Conventional Commits](https://www.conventionalcommits.org/) required. CI rejects non-conforming titles.

```
feat(api): add user search endpoint
fix(web): hydration mismatch on navbar
chore: bump hono to 4.12
docs: document env vars
```

`check-pull-request.yml` validates both the PR title and every commit message.

---

## 3. PR process

The cycle, in order:

1. **Branch from `dev`.** `git checkout dev && git pull && git checkout -b feature/my-change`.
2. **Open the PR against `test`.** Fill the PR template (Type of change, breaking changes if any, testing notes).
3. **CI runs.** `check-branch`, `check-pull-request`, `ci` must all pass. CODEOWNERS auto-requests review from the appropriate team (`.github/CODEOWNERS`).
4. **Review.** Maintainers / team-reviewers approve.
5. **Merge into `test`.** Squash + delete branch. `release-test.yml` runs on the push to `test` and deploys to testing via Dokploy.
6. **Periodic release: `test` → `main`.** When `test` is ready to ship, open a PR `test → main`. CI runs again. Merge to trigger `release-prod.yml` (publishes `:latest` + `:<semver>` images + curls the prod Dokploy webhook).
7. **Sync `main` → `dev`.** After step 6, open (or auto-create) a PR `main → dev`. This catches release commits, hotfixes that landed directly on `main`, and any merge commits.

A `feature/*` branch never opens a PR to `main` directly. Hotfixes on `main` always get a follow-up `main → dev` sync PR.

### What CI checks

`ci.yml` runs on every PR (any branch):

- `pnpm install --frozen-lockfile`
- `pnpm lint`
- `pnpm check` (combined lint + format + rule check via Biome)
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

The template ships one feature (`users`) to demonstrate the layered pattern. Add your domain by following the same shape.

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
app.route('/<feature>', <feature>Routes);
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

The canonical example in this repo is `apps/web/src/features/auth/` (the `getCurrentSession` glue + `auth.service.ts` for HTTP calls). Copy that shape for new features.

### DB model

1. Edit `packages/db/prisma/schema.prisma`.
2. Run `pnpm --filter @app/db migrate:dev -- --name <feature>` to author the migration.
3. Generated client types flow automatically to `apps/api` and `apps/web` via `@app/db` re-exports.

---

## 6. Conventions

### Code style

- Biome is the single tool for format + lint. No eslint, no prettier.
- One config at **root** (`biome.json`) — every package picks it up. No per-package overrides.
- VS Code's Biome extension (`.vscode/extensions.json`) auto-formats on save.
- Manual: `pnpm lint:fix` or `pnpm format`.

### Imports

- `import type { X }` for type-only — keeps types out of bundles.
- Group: external → `@/internal` → relative. Biome sorts automatically.

### Logging

- Backend: `apps/api/src/logger.ts` (pino). Use `logger.info/warn/error/debug`. The middleware auto-attaches `request_id` and (for authed routes) `user_id`.
- Frontend: `apps/web/src/lib/logger.ts`. **Dev-only** — no-op in prod builds. Don't use for analytics.
- Web API client: `apps/web/src/lib/api-client.ts` emits `logger.debug` per request (method, path, hasAuth, hasBody, durationMs). Same dev-only contract.

### Env vars

- Add to `apps/api/.env.example` + `apps/api/src/env.ts` (zod schema).
- Add to `apps/web/.env.example` + `apps/web/src/lib/env/{client,server}.ts`.
- Add to root `.env.example` only if consumed by docker compose.
- **Never** put `NEXT_PUBLIC_API_URL` in root `.env` for Docker — it's hardcoded in the compose file. See the README "Docker" section.
- Test-env deploy vars go in GitHub Secrets (see `.github/SECRETS.md`).
- Never use `process.env.X` outside the env files.

### Hoisting deps

Add a dependency to root when 2+ packages need it. Run:

```bash
pnpm add -D <pkg>          # to root devDependencies
pnpm add <pkg>             # to root dependencies (runtime shared)
# Remove from each sub-package's package.json that had it.
```

One-version-per-repo. CI runs `pnpm install --frozen-lockfile` and fails on drift.

---

## 7. Common tasks

### Add a dependency

```bash
pnpm --filter @app/api add <pkg>          # runtime, single package
pnpm --filter @app/api add -D <pkg>       # dev, single package
# Hoist to root when 2+ packages use it:
pnpm add -w -D <pkg>                       # root devDependencies
pnpm add -w <pkg>                          # root dependencies
# Always commit package.json AND pnpm-lock.yaml together.
```

If the package compiles native code on install (e.g. sharp, prisma engines), add it to `pnpm-workspace.yaml` `onlyBuiltDependencies`.

### Add a shadcn component

```bash
cd apps/web
pnpm dlx shadcn@latest add <component>
```

Components land in `apps/web/src/components/ui/`. The root `biome.json` skips formatting those files (`!**/apps/**/src/components/ui`).

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