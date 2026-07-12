# GitHub secrets reference

Every credential the CI/CD pipeline reads comes from **GitHub Secrets**. No tokens, hostnames, or webhooks are hardcoded in workflow YAML.

## Clerk secrets

Two patterns coexist:

1. **Per-env** — `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is split into `_DEV`/`_TEST`/`_PROD` so each web build target uses its own Clerk instance (dev, staging, prod). Each env can wire a different Clerk dashboard / plan / domain.
2. **Single** — `NEXT_PUBLIC_CLERK_SIGN_IN_URL` and `NEXT_PUBLIC_CLERK_SIGN_UP_URL` are the same in every env because the app's auth routes are identical. One secret each.

| Secret | What it controls |
| --- | --- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY_DEV` | Local dev + `ci.yml` pr-check. `pk_test_…` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY_TEST` | `release.test.yml` (push to `test`). `pk_test_…` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY_PROD` | `release.prod.yml` (push to `main`). `pk_live_…` |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | Entry route for sign-in (`/auth/iniciar-sesion` by default). Same in every env. |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | Entry route for sign-up (`/auth/registro` by default). Same in every env. |

The `NEXT_PUBLIC_*` prefix inlines the value into the JS bundle at build time.

`CLERK_SECRET_KEY` is **not** in the CI secrets list. The api (`apps/api/src/auth/clerk.ts`) uses it for JWT verification — that runs at runtime inside the Docker container, where the value is set via compose `environment:` from the host `.env` (or the deployment platform's secret manager). CI never sees the secret key.

## Required for `release.prod.yml` and `release.test.yml`

| Secret | Notes |
| --- | --- |
| `DOCKERHUB_USERNAME` | Docker Hub user or org. Doubles as the image namespace. |
| `DOCKERHUB_TOKEN` | Docker Hub access token (Settings → Security → New Access Token). |
| `DOKPLOY_URL` | Base URL of your Dokploy instance, e.g. `https://dokploy.example.com`. |
| `DOKPLOY_DEPLOY_WEBHOOK_API_PROD` | Dokploy webhook ID for the **prod** api service. |
| `DOKPLOY_DEPLOY_WEBHOOK_WEB_PROD` | Same for the **prod** web service. |
| `DOKPLOY_DEPLOY_WEBHOOK_API_TEST` | Dokploy webhook ID for the **test** api service. |
| `DOKPLOY_DEPLOY_WEBHOOK_WEB_TEST` | Same for the **test** web service. |
| `NEXT_PUBLIC_TEST_API_URL` | Public URL of the api in the **test** env (baked into the test web image). |
| `NEXT_PUBLIC_API_URL` | Public URL of the api in the **prod** env (baked into the prod web image). |

## Required only for `ci.yml`

No CI-only secrets. The `pr-check` job reuses the `_DEV` variants of the per-env Clerk keys listed above:

- `secrets.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY_DEV`
- `secrets.NEXT_PUBLIC_CLERK_SIGN_IN_URL` (single secret, used everywhere)
- `secrets.NEXT_PUBLIC_CLERK_SIGN_UP_URL` (single secret, used everywhere)

Postgres in CI is a throwaway service container, no external secret needed.

## Optional (variable, not secret)

| Variable | Default | Notes |
| --- | --- | --- |
| `IMAGE_NAMESPACE` | falls back to `DOCKERHUB_USERNAME` | Used as the namespace between the registry host and the service name (e.g. `<ns>/api`). Set this variable when your repo's image namespace differs from your Docker Hub user — typical for org-owned repos or when publishing under a different org. |

`IMAGE_NAMESPACE` is consumed by `release.prod.yml` and `release.test.yml` for image tags, cache namespace, and registry path. The Docker `login-action` always uses `DOCKERHUB_USERNAME` directly — that's the actual login, not the namespace.

## Runtime-only secrets (not in CI)

These are set in `docker-compose.prod.yml` (or your deployment platform's secret manager), not in GitHub Secrets:

| Variable | Notes |
| --- | --- |
| `CLERK_SECRET_KEY` | Required by the api at runtime to verify Clerk JWTs. Set in the host `.env` for `pnpm compose:prod`, or as a runtime env in your deploy target (Dokploy, ECS, etc.). |
| `DATABASE_URL` | Postgres connection string for the api runtime. Set in the host `.env`. |

CI never needs these because it doesn't run the api or connect to the database at runtime — only typecheck, test, and build.

## Two release workflows, two channels

Each branch has its own release workflow with its own semantic-release channel, image tags, cache namespace, and Dokploy webhooks:

| Workflow | Trigger | Channel | Tag scheme | Cache | Webhooks fired |
| --- | --- | --- | --- | --- | --- |
| `release.prod.yml` | push to `main` | `latest` (stable) | `:stable` + `:<semver>` | `:buildcache` | prod |
| `release.test.yml` | push to `test` | `test` (prerelease) | `:test` + `:<semver>-test` | `:buildcache-test` | test |

Both deploys trigger via `curl -L -X GET --fail-with-body $DOKPLOY_URL/api/deploy/<webhook>` so Dokploy pulls the freshly-pushed tag and redeploys.

## Configure Dokploy webhooks

Dokploy exposes per-service `deploy/<webhook-id>` endpoints. Each id is a 32-char opaque string. Store the values in the secrets listed above. The Dokploy side should pull the matching tag from the registry and redeploy.