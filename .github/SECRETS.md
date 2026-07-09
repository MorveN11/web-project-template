# GitHub secrets reference

Every credential the CI/CD pipeline reads comes from **GitHub Secrets**. No tokens, hostnames, or webhooks are hardcoded in workflow YAML.

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
| `CLERK_SECRET_KEY` | `sk_test_…` for staging envs, `sk_live_…` for prod. |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_test_…` or `pk_live_…`. |
| `NEXT_PUBLIC_API_URL` | Public URL of the api in the **prod** env (baked into the prod web image). |
| `NEXT_PUBLIC_TEST_API_URL` | Public URL of the api in the **test** env (baked into the test web image). |

## Optional (variable, not secret)

| Variable | Default | Notes |
| --- | --- | --- |
| `IMAGE_NAMESPACE` | falls back to `DOCKERHUB_USERNAME` | Used as the namespace between the registry host and the service name (e.g. `<ns>/api`). Set this variable when your repo's image namespace differs from your Docker Hub user — typical for org-owned repos or when publishing under a different org. |

`IMAGE_NAMESPACE` is consumed by `release.prod.yml` and `release.test.yml` for image tags, cache namespace, and registry path. The Docker `login-action` always uses `DOCKERHUB_USERNAME` directly — that's the actual login, not the namespace.

## Required only for `ci.yml`

Already covered above. Postgres in CI is a throwaway service container, no external secret needed.

## Two release workflows, two channels

Each branch has its own release workflow with its own semantic-release channel, image tags, cache namespace, and Dokploy webhooks:

| Workflow | Trigger | Channel | Tag scheme | Cache | Webhooks fired |
| --- | --- | --- | --- | --- | --- |
| `release.prod.yml` | push to `main` | `latest` (stable) | `:stable` + `:<semver>` | `:buildcache` | prod |
| `release.test.yml` | push to `test` | `test` (prerelease) | `:test` + `:<semver>-test` | `:buildcache-test` | test |

Both deploys trigger via `curl -L -X GET --fail-with-body $DOKPLOY_URL/api/deploy/<webhook>` so Dokploy pulls the freshly-pushed tag and redeploys.

## Configure Dokploy webhooks

Dokploy exposes per-service `deploy/<webhook-id>` endpoints. Each id is a 32-char opaque string. Store the values in the secrets listed above. The Dokploy side should pull the matching tag from the registry and redeploy.
