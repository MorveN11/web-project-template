# Agent guidance for this repo

## For AI assistants (Claude Code, etc.)

### Discovery first
- Use `codebase-memory-mcp` (or Grep/Glob fallback) to locate symbols before reading whole files.
- Trust the existing patterns. New code should match the layered structure already here.

### Where to put new code

| New… | Goes in |
| --- | --- |
| Prisma model | `packages/db/prisma/schema.prisma` — then `pnpm db:migrate:dev` |
| Backend feature | `apps/api/src/<feature>/{repository,service,routes,schemas,mappers,index}.ts`, mount in `src/index.ts` |
| Frontend feature | `apps/web/src/features/<feature>/{actions,schemas,types,constants}.ts` + `services/<feature>.service.ts` |
| Shared types (api ↔ web) | `packages/shared-types/src/` (zod schemas) or `import type ... from '@app/db'` |
| New env var | api: `apps/api/.env.example` + `apps/api/src/env.ts`. web: `apps/web/.env.example` + `apps/web/src/lib/env/{client,server}.ts`. root: `.env.example`. Test-env keys live in `.github/SECRETS.md` since the test channel deploys via Dokploy, not via a `.env` file on disk. |

### Backend layering
- **Route** → parses with zod, hands to service, maps `Result` via `handleResult`. No DB calls.
- **Service** → owns business rules + `Result<T>`. Calls the repository. No HTTP types.
- **Repository** → wraps `Database` from `@app/db`. Fluent Prisma facade, one class per feature. No business rules.

### Backend logging cheatsheet
- `LOG_LEVEL=debug` shows request lines + Prisma `error/warn` events.
- `LOG_QUERIES=true` enables Prisma `query` events (params + duration).
- Production: keep `LOG_LEVEL=info` (default). `LOG_QUERIES=false`.

### Frontend logging cheatsheet
- `import { logger } from '@/lib/logger'`. Logger is dev-only — production builds strip every call because `NODE_ENV` is inlined at build time and `isDev` lives in `lib/env/server`.
- `apps/web/src/lib/api-client.ts` logs each request via this same logger (`api:request` / `api:response` / `api:error`). Useful for debugging sync/redirect loops in dev.
- For request payloads or anything sensitive, the dev-only logger is the right surface.

### VS Code workspace
- `.vscode/settings.json` configures Biome as default formatter + format-on-save + safe-fix-on-save (imports + quickfix only). No `formatOnPaste` accidental cascade.
- `.vscode/extensions.json` recommends the right extension set. Install on first open.
- TypeScript SDK is pinned to the hoisted root via `js/ts.tsdk.path = ./node_modules/typescript/lib` — one version for the whole repo.

### Hard rules
- **Do not import `process.env` outside the env files.** api: `apps/api/src/env.ts`. web: `apps/web/src/lib/env/{client,server}.ts`. Logger reads `isDev` from `lib/env/server`.
- **Do not import `@prisma/client` runtime into `apps/web`.** Use `import type { ... } from '@app/db'`.
- **Do not duplicate shared devDependencies.** biome, typescript, vitest, tsx, @types/node live at the root. Per-package `package.json` only lists tools unique to that package. CI verifies via `pnpm install --frozen-lockfile`.
- **Do not bypass `pnpm lint`.** CI runs it on every PR.
- **Do not commit secrets.** Use `.env.example` with placeholder values.
- **Conventional commits only** — `feat`, `fix`, `chore`, `docs`, etc. CI rejects non-conforming titles/commits.
- **Never put `NEXT_PUBLIC_API_URL` in root `.env`.** It's a build-time-inlined var; the compose file hardcodes `http://api:8080` for Docker. The web's `client.ts` provides the dev default. The full "Docker" section in README explains why.
- **Gitflow is `dev → test → main → dev`**. Features fork from `dev`, PR into `test`, periodic release `test → main`, then sync `main → dev`. Never PR a `feature/*` directly into `main`.
- **Production DB may be Neon.** Set `DATABASE_URL` to the `-pooler` endpoint and `DIRECT_URL` to the direct endpoint (Neon rejects DDL on the pooler). Docker dev leaves `DIRECT_URL` empty. Runtime adapter auto-selects in `packages/db/src/client.ts` by URL substring (`.neon.tech` / `-pooler.`) — no `DATABASE_PROVIDER` flag.

### Analytics (Umami) — required by default
- Self-hosted Umami (or any Sentry-compatible analytics) tracked via `<Script>` from `next/script`. Single website-id, per-env Dokploy override.
- `apps/web/src/components/umami-script.tsx` is a `'use client'` component that returns `null` when `NODE_ENV=development` OR when `NEXT_PUBLIC_UMAMI_SCRIPT_URL` / `NEXT_PUBLIC_UMAMI_WEBSITE_ID` are unset. Mirrors the Sentry dev-never-tracks gate.
- Two-layer disable so a stray testing URL in a dev `.env` cannot fire requests from the laptop.
- Env vars (all optional, deploy-only): `NEXT_PUBLIC_UMAMI_SCRIPT_URL` + `NEXT_PUBLIC_UMAMI_WEBSITE_ID`. Build arg only — `NEXT_PUBLIC_*` is inlined at build time.
- Wired into `apps/web/src/app/layout.tsx` once, renders a single `<Script strategy="afterInteractive" defer ... />`.
- Umami host needs to be allowlisted in CSP `script-src` + `connect-src` in `next.config.ts` (use a specific hostname, not wildcard — single host).
- Secrets: `NEXT_PUBLIC_UMAMI_SCRIPT_URL` + `NEXT_PUBLIC_UMAMI_WEBSITE_ID` (Dokploy env / host `.env`). Single value per env, override per env as needed.

### Error monitoring (GlitchTip / Sentry-compatible) — required by default
- GlitchTip is the recommended error aggregator. Sentry SDK is API-compatible — works unchanged.
- Every fork MUST wire it by default:
  - **Backend**: `apps/api/src/sentry.ts` exports `initSentry()`. Called once at boot in `src/index.ts` after `attachPrismaLogging()`. `app.onError` unhandled branch calls `Sentry.captureException`. Pino still logs everything (dedup happens at the aggregator).
  - **Frontend**: client config in `apps/web/sentry.client.config.ts`, server in `sentry.server.config.ts`, edge in `sentry.edge.config.ts` (loaded by `proxy.ts` which is edge runtime). `apps/web/src/instrumentation.ts` registers both via `NEXT_RUNTIME`.
- **Dev never tracks — enforced at runtime**: every init function has a hard `NODE_ENV !== 'development'` gate. If `NODE_ENV=development`, Sentry is skipped regardless of whether `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` is set. Two layers of disable so a stray DSN in a dev `.env` (a common copy-paste mistake when provisioning testing) cannot leak laptop events to GlitchTip.
- All env vars are optional. Leave them empty in dev (default). Set them ONLY on deployed envs (testing / production). The Docker compose prod file hard-pins `NODE_ENV: production` on api + web so the gate flips off there.
- Environment tag (`SENTRY_ENVIRONMENT` / `NEXT_PUBLIC_SENTRY_ENVIRONMENT`) drives GlitchTip UI filtering. Use `testing` / `production` per env.
- Tunnel route at `/api/glitchtip-tunnel` (App Router `route.ts`) bypasses ad-blockers + avoids leaking the DSN hostname in browser network tab.
- Source maps: `SENTRY_AUTH_TOKEN` build arg only. NEVER set in the container's runtime env — leaks via `docker history`.
- Trace sample rate default 0.01 (1%). Override per env for higher fidelity.
- `autoSessionTracking: false` — GlitchTip doesn't support Sentry sessions.
- Secrets: `SENTRY_AUTH_TOKEN_PROD` / `SENTRY_AUTH_TOKEN_TEST` (GitHub, build-time); `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` / `SENTRY_ENVIRONMENT` / `NEXT_PUBLIC_SENTRY_ENVIRONMENT` / `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` (Dokploy env / host `.env`, NEVER set in dev).

### Redis key naming (required convention for every fork)
- Every fork MUST namespace its Redis keys via ioredis `keyPrefix` on the client (see `apps/api/src/cache/redis.ts`). The client computes the prefix as `${REDIS_KEY_PREFIX}${env.NODE_ENV}-` so dev/testing/prod never collide, even on shared Redis.
- `REDIS_KEY_PREFIX` defaults to the app name (`web-project-template-`). Override to your fork's project name when you fork the template — e.g. Chacanos uses `REDIS_KEY_PREFIX=chacanos-`.
- Override per-environment ONLY if api + worker of the same fork point at the same Redis (e.g. `REDIS_KEY_PREFIX=chacanos-api-` for api, `chacanos-worker-` for worker) — DON'T bypass the NODE_ENV join.
- The high-level helpers (`redisGet` / `redisSet` / `redisDel`) take unprefixed keys; ioredis prepends the joined prefix transparently. The per-cache `L2_KEY` factories in `cache/clerk-user.ts` + `cache/user-session.ts` no longer prepend `prod:` / `dev:` — env isolation is handled at the client layer.
- Resulting key shape: `<app-name>-<env>-<cache-key>`, e.g. `chacanos-development-user:session:v1:<clerkId>`, `chacanos-production-clerk:user:v1:<sub>`.

### Anti-patterns to avoid
- Per-feature service that talks to `database` directly. The repository facade isolates schema details from business rules.
- Fat services that embed business rules. Move decisions into the entity or a small domain helper.
- DB calls in routes. Routes only adapt HTTP → service call → `handleResult`.
- Client components for things that can be server components.
- `any` types. Prefer `unknown` + narrowing or proper Zod inference.
- A logger module that actually emits in production on the web.
- Adding hooks, lint-staged, commitlint, etc. as per-package deps. CI handles enforcement; VS Code handles local format/fix.
- Multiple `biome.json` files (sub-packages had them once — consolidated into one root config).