# Contributing

How to add a feature, fix a bug, and ship it through CI/CD without breaking anything.

## Workflow

```
feature/* (or fix/*, chore/*) ──► test ──► main
        ▲                ▲           ▲
        │                │           │
   your dev       PR + CI gate    prod release
```

1. **Branch from `test`.** Use a conventional prefix: `feat/`, `fix/`, `chore/`, `docs/`, `refactor/`, `test/`.
2. **Open a PR into `test`.** CI runs `lint + typecheck + build`. Fix anything that breaks — the PR blocks until green.
3. **After merge into `test`** — `release.test.yml` builds a `:test` image, pushes it, and curls the test Dokploy webhook. Smoke-test the staging env.
4. **Promote `test` → `main`** — usually a separate PR or direct push once staging is verified. `release.prod.yml` builds `:stable`, deploys to prod.

## Branch naming

Enforced by `.github/workflows/check-branch.yml`. Pattern:

```
feat/<ticket-id>-short-description
fix/<ticket-id>-short-description
chore/short-description
docs/short-description
refactor/short-description
test/short-description
```

Examples:
- `feat/42-pagination-metadata`
- `fix/clerk-webhook-401-tunnel`
- `chore/bump-hono-4-13`

## Commit messages

Enforced by `.github/workflows/check-pull-request.yml`. Conventional commits:

```
feat(api): add /users/me admin list endpoint
fix(web): re-render nav after sign-out
chore(deps): bump zod to 4.5
docs: explain the sync model in README
refactor(api): extract openapi/security constants
test(api): add coverage for result envelope
```

Format: `<type>(<scope>): <subject>`. Subject in imperative mood, ≤ 72 chars. Body optional. Use `BREAKING CHANGE:` footer for breaking changes.

## Local pre-flight

Before pushing:

```bash
# Format + lint
pnpm lint:fix

# Typecheck
pnpm typecheck

# Build both apps
pnpm build

# If schema changed
pnpm db:migrate:dev --name your_change_name
```

CI re-runs these on every PR. Catch failures locally first — saves the 90s PR cycle.

## Adding a new env var

Three places, same key, same order in the file:

| File | Purpose |
| --- | --- |
| `apps/<app>/src/env.ts` | Zod schema with `.default()` or `.min(1)` for required |
| `apps/<app>/.env.example` | Placeholder + comment |
| `apps/<app>/.env` | Your actual local value (gitignored) |

After editing, `pnpm typecheck` to confirm `env.<KEY>` is type-safe. If the env var is `NEXT_PUBLIC_*`, also add it to `apps/web/src/lib/env/client.ts`.

## Adding a new feature (api side)

1. **Pick a domain name** (singular noun: `item`, `order`, `comment`).
2. **Create `apps/api/src/features/<name>/`** with this layout:
   ```
   routes.ts       OpenAPIHono routers + createRoute definitions
   schemas.ts      zod request/response schemas (or live in shared-types)
   service.ts      Result<T> business logic
   repository.ts   fluent facade over Prisma
   mappers.ts      Prisma row → wire DTO
   index.ts        barrel + file-role comment
   ```
3. **Split into public + admin sub-routers** if some endpoints require auth:
   ```ts
   const public = new OpenAPIHono();
   public.openapi(listRoute, ...);
   public.openapi(getRoute, ...);

   const admin = new OpenAPIHono();
   admin.use('*', requireAuth);
   admin.use('*', requireRole(UserRoleConst.ADMIN));
   admin.openapi(createRoute, ...);

   export const myRoutes = new OpenAPIHono().route('/', public).route('/', admin);
   ```
4. **Mount in `apps/api/src/index.ts`**:
   ```ts
   app.route('/mything', myRoutes);
   ```
5. **Wire shared constants** — `src/openapi/security.ts` + `src/openapi/responses.ts`. Don't redefine inline.
6. **Verify**: `pnpm --filter @app/api build && curl http://localhost:4000/openapi.json | jq .paths`.

## Adding a new feature (web side)

1. **Pick a route group** — public (`(auth)/`), any-user (`(authenticated)/`), ADMIN-only (`(admin)/`), CLIENT-only (`(client)/`).
2. **Drop the page** under the group:
   - Public: `app/<route>/page.tsx`
   - Any-user: `app/(authenticated)/<route>/page.tsx`
   - ADMIN-only: `app/(admin)/<route>/page.tsx`
   - CLIENT-only: `app/(client)/<route>/page.tsx`
3. **Add the feature folder** under `apps/web/src/features/<name>/`:
   - `actions.ts` — server actions calling the api
   - `services/<name>.service.ts` — typed `apiClient` wrappers
   - `types.ts` — DTO shapes
4. **Render guards** — for sub-tree visibility:
   - Server: `<RequireRole role={UserRole.ADMIN}>` or `<IfRole role={UserRole.ADMIN}>`
   - Client: `useRole()` / `useIsAdmin()` / `useIsClient()`
5. **Verify**: `pnpm --filter @app/web build`. Next.js shows the new route in the build output table.

## Adding a new zod schema (wire shape)

1. **Pick the file** — feature-specific → `packages/shared-types/src/features/<name>.ts`. Cross-feature → `cross-cutting/<name>.ts`.
2. **Schema + type together**, with `.openapi('PascalName')`:
   ```ts
   export const myDtoSchema = z.object({ ... }).openapi('MyDto');
   export type MyDto = z.infer<typeof myDtoSchema>;
   ```
3. **Re-export from `packages/shared-types/src/index.ts`**.
4. **Reference in api routes** — shows up in `/openapi.json` and Scalar's components panel.
5. **Consume in web** — `import type { MyDto } from '@app/shared-types'` for typed fetch wrappers.

## What CI checks

`ci.yml` runs on every PR:

| Step | What it does |
| --- | --- |
| `pnpm install --frozen-lockfile` | Pins versions |
| `pnpm lint` | Biome — lint + format |
| `pnpm typecheck` | tsc --noEmit on every typed package |
| `pnpm test` | Vitest (pass with no tests today) |
| `pnpm --filter @app/api build` | tsc → dist/ |
| `pnpm --filter @app/web build` | next build |

No Postgres in CI — migrations are runtime concerns (run inside the api container's entrypoint).

## Workflows at a glance

| File | Trigger | Purpose |
| --- | --- | --- |
| `ci.yml` | PR to `main`/`test` | Lint + typecheck + test + build gate |
| `check-branch.yml` | PR opened | Enforce branch naming convention |
| `check-pull-request.yml` | PR opened | Enforce commit-message convention |
| `release.prod.yml` | push to `main` | Build + push `:stable` + `<semver>` images, fire prod Dokploy webhook |
| `release.test.yml` | push to `test` | Build + push `:test` + `<semver>-test` images, fire test Dokploy webhook |

## When you need to debug a failing pipeline

| Symptom | First thing to check |
| --- | --- |
| PR lint fails | `pnpm lint:fix` then commit the result |
| PR typecheck fails | Run `pnpm typecheck` locally; usually a forgotten type or stale import |
| PR build fails | Run `pnpm build` locally; check `.next/` or `dist/` for the actual error |
| Release image build fails | Check `apps/<app>/Dockerfile` matches the new code; `pnpm db:generate` was run if the schema changed |
| Dokploy webhook returns 5xx | Check the Dokploy side (compose, env, image tag) — the workflow just curls the webhook |

## Releasing

You don't need to do anything special for a release. Merge into `test` → test image goes out. Merge into `main` → prod image goes out. semantic-release computes the next version from conventional commits.

If you need to cut a hotfix to prod:
1. Branch from `main` (`fix/<description>`).
2. PR directly to `main` (skip `test`). The CI gate still runs.
3. After merge, `release.prod.yml` fires with the bumped version.

## See also

- `README.md` — high-level architecture, dev process, conventions
- `apps/api/README.md` — Hono backend architecture
- `apps/web/README.md` — Next.js frontend architecture
- `packages/db/README.md` — Prisma schema + migrations
- `packages/shared-types/README.md` — shared zod schemas
- `SECRETS.md` — required GitHub Secrets
- `.env.example` (root + per-app) — required env vars
