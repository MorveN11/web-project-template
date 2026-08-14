# GitHub secrets reference

Every credential the CI/CD pipeline reads comes from **GitHub Secrets**. No tokens, hostnames, or webhooks are hardcoded in workflow YAML.

Forks: copy this file as-is. All `_PROD` / `_TEST` / `_DEV` suffix splits match the branch + Dokploy deploy target. Replace `web-project-template` in compose names + `your-glitchtip.example.com` / `your-umami.example.com` in GlitchTip/Umami hostnames with your own.

## Clerk secrets

Two patterns coexist:

1. **Per-env** — `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is split into `_DEV`/`_TEST`/`_PROD` so each web build target uses its own Clerk instance (dev, testing, prod). Each env can wire a different Clerk dashboard / plan / domain.
2. **Single** — `NEXT_PUBLIC_CLERK_SIGN_IN_URL` and `NEXT_PUBLIC_CLERK_SIGN_UP_URL` are the same in every env because the app's auth routes are identical. One secret each.

| Secret | What it controls |
| --- | --- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY_DEV` | Local dev + `ci.yml` pr-check. `pk_test_…` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY_TEST` | `release.test.yml` (push to `test`). `pk_test_…` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY_PROD` | `release.prod.yml` (push to `main`). `pk_live_…` |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | Entry route for sign-in (`/auth/iniciar-sesion` by default). Same in every env. |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | Entry route for sign-up (`/auth/registro` by default). Same in every env. |

The `NEXT_PUBLIC_*` prefix inlines the value into the JS bundle at build time. Set them once in GitHub Secrets + `pnpm install` is all it takes for a fresh fork.

`CLERK_SECRET_KEY` is **not** in the CI secrets list. The api (`apps/api/src/auth/clerk.ts`) uses it for JWT verification — that runs at runtime inside the Docker container, where the value is set via compose `environment:` from the host `.env` (or the deployment platform's secret manager). CI never sees the secret key.

## Required for `release.prod.yml` and `release.test.yml`

Every row below is referenced as `${{ secrets.<NAME> }}` in the workflow. Adding a row here without a matching GitHub Secret breaks the build.

| Secret | Used in | Purpose |
| --- | --- | --- |
| `DOCKERHUB_USERNAME` | both | Docker Hub login. Doubles as the default image namespace. |
| `DOCKERHUB_TOKEN` | both | Docker Hub access token (Settings → Security → New Access Token). |
| `DOKPLOY_URL` | both | Base URL of the Dokploy instance (e.g. `https://dokploy.example.com`). |
| `DOKPLOY_DEPLOY_WEBHOOK_API_PROD` | `release.prod.yml` | Dokploy webhook ID for the prod api service. |
| `DOKPLOY_DEPLOY_WEBHOOK_WEB_PROD` | `release.prod.yml` | Dokploy webhook ID for the prod web service. |
| `DOKPLOY_DEPLOY_WEBHOOK_API_TEST` | `release.test.yml` | Dokploy webhook ID for the test api service. |
| `DOKPLOY_DEPLOY_WEBHOOK_WEB_TEST` | `release.test.yml` | Dokploy webhook ID for the test web service. |
| `NEXT_PUBLIC_API_URL` | `release.prod.yml` | Public URL of the api in the prod env (baked into the prod web image). |
| `NEXT_PUBLIC_TEST_API_URL` | `release.test.yml` | Public URL of the api in the test env (baked into the test web image). |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY_PROD` | `release.prod.yml` | Clerk publishable key for prod (see table above). |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY_TEST` | `release.test.yml` | Clerk publishable key for test (see table above). |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | both | Sign-in entry route. Same in every env. |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | both | Sign-up entry route. Same in every env. |
| `SENTRY_AUTH_TOKEN_PROD` | `release.prod.yml` | GlitchTip auth token for source-map upload on the prod web build. Build-time only — never runtime (image-history leak). |
| `SENTRY_AUTH_TOKEN_TEST` | `release.test.yml` | Same, for the test web build. |
| `NEXT_PUBLIC_SENTRY_DSN_PROD` | `release.prod.yml` | GlitchTip web DSN for the prod web build (inlined at build time). |
| `NEXT_PUBLIC_SENTRY_DSN_TEST` | `release.test.yml` | GlitchTip web DSN for the test web build (inlined at build time). |
| `NEXT_PUBLIC_UMAMI_SCRIPT_URL` | `release.prod.yml` only | Umami script URL (e.g. `https://your-umami.example.com/script.js`). Inlined at build time. Production only — test deploys deliberately omit. |
| `NEXT_PUBLIC_UMAMI_WEBSITE_ID` | `release.prod.yml` only | Umami website-id. Inlined at build time. Production only. |

## Required only for `ci.yml`

No CI-only secrets. The `pr-check` job reuses the `_DEV` variants of the per-env Clerk keys listed above:

- `secrets.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY_DEV`
- `secrets.NEXT_PUBLIC_CLERK_SIGN_IN_URL`
- `secrets.NEXT_PUBLIC_CLERK_SIGN_UP_URL`

Postgres in CI is a throwaway service container, no external secret needed.

## Optional (variable, not secret)

| Variable | Default | Notes |
| --- | --- | --- |
| `IMAGE_NAMESPACE` | falls back to `DOCKERHUB_USERNAME` | Image namespace between registry host and service name. Set when the repo's image namespace differs from the Docker Hub user (org-owned repos). |

`IMAGE_NAMESPACE` is consumed by `release.prod.yml` and `release.test.yml` for image tags, cache namespace, and registry path. The Docker `login-action` always uses `DOCKERHUB_USERNAME` directly.

## Build-time only env (NOT GitHub Secrets)

These flow through Dokploy build-arg injection (or `host .env` for local `docker compose -f docker-compose.prod.yml`) because `NEXT_PUBLIC_*` is inlined into the JS bundle at build time. Setting them as runtime env has no effect — the browser reads the value baked in at build, not from `process.env` at runtime.

| Variable | Purpose | Default |
| --- | --- | --- |
| `NEXT_PUBLIC_LOG_LEVEL` | Client-side log level threshold. | `warn` |
| `NEXT_PUBLIC_SENTRY_ENVIRONMENT` | Env tag for GlitchTip UI filtering. **Hardcoded per workflow** (`production` for `release.prod.yml`, `testing` for `release.test.yml`). Not a secret. | `development` |
| `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` | Fraction of Sentry transactions to sample. **Hardcoded `0.01`** per workflow. | `0.01` |

Note: `SENTRY_AUTH_TOKEN` is also build-time only — see the `Required for release` table above.

## Runtime-only env (not in CI)

These are set in `docker-compose.prod.yml` `environment:` blocks (or your deployment platform's secret manager), not in GitHub Secrets. CI never needs them because it doesn't run the api or connect to the database at runtime — only typecheck, test, and build.

### API runtime env (read by `apps/api/src/env.ts`)

| Variable | Purpose | Default |
| --- | --- | --- |
| `CLERK_SECRET_KEY` | Required by the api at runtime to verify Clerk JWTs. | none (fail-fast) |
| `CLERK_PUBLISHABLE_KEY` | Clerk publishable key (api-side runtime, used by Clerk SDK BAPI calls). | `''` |
| `CLERK_AUTHORIZED_PARTIES` | CSV of origins allowed to mint JWTs (`http://localhost:3000,http://localhost:4000` for dev). | `http://localhost:3000` |
| `CLERK_WEBHOOK_SIGNING_SECRET` | Signing secret for `/webhooks/clerk`. Configure in the Clerk dashboard. | placeholder |
| `DATABASE_URL` | Postgres connection string. For Neon, use the `-pooler` endpoint. | none |
| `DIRECT_URL` | Direct (non-pooler) postgres URL used by `prisma migrate`. Required for Neon (pooler rejects DDL). Empty for self-hosted compose. | `''` |
| `REDIS_URL` | Redis connection for the cache layer (`L1` in-process + `L2` Redis). | `redis://localhost:6379` |
| `REDIS_KEY_PREFIX` | Per-app namespace for cache keys. The ioredis client computes `keyPrefix: \`${REDIS_KEY_PREFIX}${NODE_ENV}-\`` so dev/testing/prod never collide. Set to `<app-name>-` (e.g. `web-project-template-`) per fork. | `web-project-template-` |
| `CORS_ORIGIN` | CSV of browser origins allowed to call the api. | `http://localhost:3000` |
| `LOG_LEVEL` | Pino log level (`debug`/`info`/`warn`/`error`). | `info` |
| `LOG_QUERIES` | When `true`, logs every Prisma query (`apps/api/src/db/prisma-logging.ts`). | `false` |
| `SEED_ENABLED` | When `true`, runs `prisma/seed.ts` at container boot (creates `admin@template.test` on empty DB). Flip to `false` in environments that don't want the seed. | `true` |
| `SENTRY_DSN` | GlitchTip DSN for the api (errors land under `service=api, environment=<tag>`). **DEPLOYED ENVS ONLY** — the SDK has a hard `NODE_ENV !== 'development'` gate so dev cannot track even if a stray DSN leaks. | `''` |
| `SENTRY_ENVIRONMENT` | Env tag for GlitchTip UI filtering. Set per env (`testing` for test, `production` for main). | `development` |
| `SENTRY_TRACES_SAMPLE_RATE` | Fraction of Sentry transactions to sample. | `0.01` |

### Web runtime env (read by `apps/web/src/lib/env/{client,server}.ts`)

The web app's runtime env is minimal because `NEXT_PUBLIC_*` is build-time inlined. After the build, only `CLERK_SECRET_KEY` + `NODE_ENV` need runtime injection — everything else lives in the bundle.

| Variable | Purpose | Default |
| --- | --- | --- |
| `CLERK_SECRET_KEY` | Server-side Clerk SDK auth (RSC + route handlers). | none (fail-fast) |
| `NODE_ENV` | Standard Next.js mode switch. **Hardcoded `production`** in `docker-compose.prod.yml` to flip the Sentry + Umami gates off. | `development` |

`NEXT_PUBLIC_*` env entries shown in the Build-time-only section above are documented there because they bake into the bundle — they're not runtime env despite the `NEXT_PUBLIC_` prefix.

## Dev-never-tracks rule (enforced at runtime)

- **Dev (`NODE_ENV=development`)**: Sentry init is skipped + Umami script renders `null`. No requests to GlitchTip or Umami. Two-layer gate (NODE_ENV check + value-must-be-present) prevents dev `.env` leaks from firing events.
- **Test (`NODE_ENV=testing`)**: Sentry tracks errors + metrics. GlitchTip UI filters by `environment=testing`. Umami does NOT track (build args deliberately omitted in `release.test.yml`).
- **Production (`NODE_ENV=production`)**: Both Sentry and Umami track. GlitchTip UI filters by `environment=production`.

GlitchTip wires to BOTH testing + production (separate DSNs: `NEXT_PUBLIC_SENTRY_DSN_TEST` + `NEXT_PUBLIC_SENTRY_DSN_PROD`). Umami wires ONLY to production (test deploys deliberately omit `NEXT_PUBLIC_UMAMI_*`).

## Two release workflows, two channels

| Workflow | Trigger | Channel | Tag scheme | Cache | Webhooks fired |
| --- | --- | --- | --- | --- | --- |
| `release.prod.yml` | push to `main` | `latest` (stable) | `:stable` + `:<semver>` | `:buildcache` | prod |
| `release.test.yml` | push to `test` | `test` (prerelease) | `:test` + `:<semver>-test.N-build` | `:buildcache-test` | test |

Both deploys trigger via `curl -L -X GET --fail-with-body $DOKPLOY_URL/api/deploy/<webhook>` so Dokploy pulls the freshly-pushed tag and redeploys.

## Configure Dokploy webhooks

Dokploy exposes per-service `deploy/<webhook-id>` endpoints. Each id is a 32-char opaque string. Store the values in the secrets listed above. The Dokploy side should pull the matching tag from the registry and redeploy.

## GitHub Secrets setup checklist

For a fresh fork, create these GitHub Secrets in order:

1. `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`
2. `DOKPLOY_URL`, `DOKPLOY_DEPLOY_WEBHOOK_{API,WEB}_{PROD,TEST}` (×4)
3. `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_TEST_API_URL`
4. `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY_{DEV,TEST,PROD}` (3)
5. `NEXT_PUBLIC_CLERK_SIGN_IN_URL`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL`
6. `SENTRY_AUTH_TOKEN_{PROD,TEST}` (2)
7. `NEXT_PUBLIC_SENTRY_DSN_{PROD,TEST}` (2)
8. `NEXT_PUBLIC_UMAMI_SCRIPT_URL`, `NEXT_PUBLIC_UMAMI_WEBSITE_ID`

Total: **20 secrets** + the optional `IMAGE_NAMESPACE` variable.

Then in Dokploy (or whichever platform runs `docker compose -f docker-compose.prod.yml`), set the **Runtime-only env** table from `host .env` — `CLERK_SECRET_KEY`, `DATABASE_URL`, `SENTRY_DSN`, etc.