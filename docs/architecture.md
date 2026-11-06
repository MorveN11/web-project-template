# Architecture

Reference for new contributors. Each section explains one layer, why it's there, and how to extend it.

---

## 1. Monorepo layout

```
web-project-template/
├── apps/
│   ├── api/                Hono backend
│   └── web/                Next.js frontend
├── packages/
│   ├── db/                 Prisma schema + PrismaClient (single source of truth)
│   └── shared-types/        zod schemas shared between api and web
├── docker-compose.yml      postgres only — host runs api/web
├── docker-compose.prod.yml  full stack — closest-to-prod validation
├── biome.json              SINGLE lint + format config (root)
├── tsconfig.base.json      shared TS config (every package extends it)
├── LICENSE / SECURITY.md / CODE_OF_CONDUCT.md / CONTRIBUTING.md
└── .github/
    ├── workflows/           check-branch, check-pull-request, ci, release.{prod,test}
    ├── ISSUE_TEMPLATE/      bug + feature forms
    ├── SECRETS.md           every GitHub secret/variable the pipeline reads
    └── CODEOWNERS           auto-requested reviewers per path
```

`pnpm-workspace.yaml` declares workspaces. **Root holds every tool that 2+ packages share** (biome, typescript, vitest, tsx, @types/node, zod, @hono/zod-openapi). Per-package `package.json` only lists what that package uniquely needs. One install at `/app/node_modules` covers every workspace.

---

## 2. Backend layering (`apps/api`)

```
HTTP request
   │
   ▼
┌────────────────────────────────────┐
│ routes.ts                          │  ← thin: parse with zod, hand off, map Result
│  zValidator('json', schema)        │
│  handleResult(await svc.foo(), c)  │
└──────────────┬─────────────────────┘
               │
               ▼
┌────────────────────────────────────┐
│ service.ts                         │  ← business rules + Result<T>
│  - permission checks (auth.userId) │
│  - validation of cross-field rules │
│  - returns Result<DTO, AppError>   │
└──────────────┬─────────────────────┘
               │
               ▼
┌────────────────────────────────────┐
│ repository.ts                      │  ← fluent Prisma facade
│  list({limit, offset})             │
│  findById(id)                      │
│  create(input)                     │
└──────────────┬─────────────────────┘
               │
               ▼
┌────────────────────────────────────┐
│ packages/db (PrismaClient)         │  ← @app/db runtime
└────────────────────────────────────┘
```

The canonical reference is `apps/api/src/features/users/`. Same file layout in every other feature.

### Shared infra (`apps/api/src/lib/`, `core/`)

Anything used by two or more features lives outside `features/`:

| Path | Purpose |
|---|---|
| `core/` | `Result<T>`/`AppError`, `handleResult`, pagination envelope builder, Prisma error mapper |
| `lib/auth/` | Clerk JWT verification (`requireAuth`) + role guard (`requireRole`) |
| `lib/cache/` | ioredis client + L1 (in-process) / L2 (Redis) caches |
| `lib/db/` | Prisma query/event logging hooks |
| `lib/http/` | rate limiting |
| `lib/openapi/` | shared `security` + error-`responses` constants for route definitions |
| `env.ts`, `logger.ts`, `sentry.ts` | fail-fast env parse, pino logger, GlitchTip/Sentry init |

Rule of thumb: feature-specific code goes under `features/<name>/`; if a second feature needs it, move it to `lib/` or `core/`.

### Rules

1. **Routes never touch the database.** They parse, hand off, map the result.
2. **Services never see HTTP types.** No `Request`, no `Context`, no `Response`. They take a `ClerkAuthContext` (typed) and return a `Result<T>`.
3. **Repositories own the data shape.** They expose fluent methods (`findById`, `list`, `create`) but don't enforce business rules. A repo can be reused across services if needed.
4. **No exceptions for business failures.** Services return `err({ code, message, status })` instead of throwing. The HTTP layer translates to a status code via `handleResult`.

### Result<T> shape

```ts
// apps/api/src/core/result.ts
export interface AppError {
  code: string;     // machine-readable, e.g. 'not_found'
  message: string;  // human-readable
  status: number;   // HTTP status to send
  cause?: unknown;  // optional, for logs only — never returned in JSON
}

export type Result<T> =
  | { success: true; data: T }
  | { success: false; error: AppError };

export const ok = <T>(data: T): Result<T> => ({ success: true, data });
export const err = (error: AppError): Result<never> => ({ success: false, error });

// Convenience factories match HttpError semantics:
errNotFound('user not found')         // { code: 'not_found', status: 404, ... }
errForbidden('not your resource')     // { code: 'forbidden', status: 403, ... }
```

`handleResult` (`apps/api/src/core/handle.ts`) translates a `Result<T>` into a Hono response:

```ts
handleResult(await service.syncSelf(auth), c)
// success  → c.json(data, 200)
// failure  → c.json({ error: { code, message } }, error.status)
```

---

## 3. Frontend layering (`apps/web`)

```
Browser
   │
   ▼
┌────────────────────────────────────┐
│ Server Component (page.tsx,        │  ← async, runs on server
│ layout.tsx, (authenticated)/...)   │     has direct DB/API access
│                                    │     uses auth() from @clerk/nextjs/server
└──────────────┬─────────────────────┘
               │ calls server action OR fetches API
               ▼
┌────────────────────────────────────┐
│ Server Action ('use server')       │  ← RSC-glue: auth + service call
│ features/<x>/actions.ts            │     returns SafeActionResult<T>
│  getCurrentSession()               │
│  safeAction(() => getMyProfile())  │
└──────────────┬─────────────────────┘
               │
               ▼
┌────────────────────────────────────┐
│ Service layer                      │  ← thin fetch wrapper
│ features/<x>/services/<x>.service  │
│  apiClient.get('/users/me')        │
│           .withAuth(token)         │
└──────────────┬─────────────────────┘
               │ HTTP + bearer token
               ▼
┌────────────────────────────────────┐
│ Hono API (apps/api)                │
└────────────────────────────────────┘
```

### Rules

1. **Pages are server components by default.** No `'use client'` unless you need state, effects, or browser APIs.
2. **No `process.env.X` in feature code.** Use `env` from `@/lib/env/client` (browser-safe) or `@/lib/env/server` (server-only).
3. **Server actions are glue.** Auth + service call + `safeAction` wrap. No business logic.
4. **RHF + zod for forms.** `features/<x>/schemas.ts` defines zod schema, used both client-side (RHF resolver) and server-side (action validation).

### Dev-only logger

`apps/web/src/lib/logger.ts` is a no-op in production (`process.env.NODE_ENV` inlined at build). Use it for debugging during development; production observability comes from the api's structured logs. `ApiClient.execute()` automatically logs every request (`api:request` / `api:response` / `api:error`) through this same dev-only logger — useful for debugging sync loops and 401/403 cascades during development.

---

## 4. Database (`packages/db`)

### Prisma 7 adapter pattern

Prisma 7 removed `datasource.url` from `schema.prisma`. Connection URL lives in `packages/db/prisma.config.js` — plain JS, not TS, so the slim api image can invoke the prisma CLI with bare `node` (no tsx/ts-node at runtime):

```js
// prisma.config.js
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// `process.env` directly instead of prisma's `env()` helper: the helper THROWS
// on a missing var, and `prisma generate` runs in the Docker build stage where
// DATABASE_URL isn't in scope yet. Migrate/studio still error on their own.
// Migrations prefer DIRECT_URL when set (Neon requires a direct endpoint for
// DDL transactions); docker dev leaves it unset → falls back to DATABASE_URL.
const database_url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

export default defineConfig({
  schema: './prisma/schema.prisma',
  migrations: {
    // esbuild bundles packages/db/prisma/seed.ts into apps/api/dist/seed.js at
    // build time, so the runtime image needs neither tsx nor the workspace deps.
    seed: 'node apps/api/dist/seed.js',
  },
  ...(database_url ? { datasource: { url: database_url } } : {}),
});
```

The runtime `PrismaClient` is built with a driver adapter chosen by URL shape in `packages/db/src/client.ts`:

```ts
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const url = process.env.DATABASE_URL!;
const isNeon = url.includes('.neon.tech') || url.includes('-pooler.');
const adapter = isNeon
  ? new PrismaNeon({ connectionString: url })
  : new PrismaPg({ connectionString: url });
export const database = new PrismaClient({ adapter, log: ['warn', 'error'] });
```

`@prisma/adapter-neon` (HTTP via `@neondatabase/serverless`) only speaks to
Neon's pooler endpoint; everything else uses `@prisma/adapter-pg` as before.
Detection is by URL substring so docker dev and Neon prod share the same
`PrismaClient` construction — no `DATABASE_PROVIDER` flag.

### Dual-URL pattern (Neon)

Neon mandates two connection strings:

| Variable | Used by | Endpoint |
| --- | --- | --- |
| `DATABASE_URL` | Runtime `PrismaClient` (driver adapter) | `-pooler` (e.g. `ep-xxx-pooler.eu-central-1.aws.neon.tech`) |
| `DIRECT_URL` | `prisma migrate` (`docker-entrypoint.sh`) | Direct (e.g. `ep-xxx.eu-central-1.aws.neon.tech`) |

Set both in the api container's runtime env (compose `environment:` for
Dokploy). `apps/api/src/env.ts` validates `DIRECT_URL` as optional — empty
falls through to `DATABASE_URL` for docker dev, where one URL is enough.

### Public surface (`@app/db`)

```ts
// api code (runtime + types):
import { database, Prisma, type User } from '@app/db';

// web code (types only — never the runtime):
import type { User } from '@app/db';
```

The runtime is a single `PrismaClient` shared across the api. Web only consumes types — the postgres runtime never reaches the browser bundle.

### Migrations

- Dev: `pnpm db:migrate:dev --name <name>` — creates + applies.
- Prod: `apps/api/docker-entrypoint.sh` runs `prisma migrate deploy` on container boot. **Migrations are never run in CI** (CI has no postgres service).

---

## 5. Auth (`@clerk/backend` + `@clerk/nextjs`)

```
                  Bearer JWT
   Browser ─────────────────► Hono api
                                 │
                                 ▼
                       ┌──────────────────┐
                       │ auth/clerk.ts    │
                       │ verifyClerkToken │
                       │   verifyToken()  │
                       │   from @clerk/   │
                       │     backend      │
                       │   JWKS cached     │
                       └────────┬─────────┘
                                │ ctx = { userId, sessionId, role, claims }
                                ▼
                       service.ts has ClerkAuthContext
```

The api uses `@clerk/backend`'s `verifyToken()` — it resolves the issuer/audience from `secretKey` automatically, fetches JWKS, and keeps verification primitives in sync with the Clerk ecosystem. `authorizedParties` is only enforced when the JWT carries an `azp` claim (frontend-issued tokens); BAPI-issued tokens skip the check.

Frontend uses `@clerk/nextjs` server functions (`auth()`, `currentUser()`) for RSC auth checks, and `SignInButton` / `UserButton` for client UI. `proxy.ts` (Next.js middleware) uses `clerkMiddleware` to gate every non-public route via `auth.protect()`.

---

## 6. Env validation

Every env var is parsed at boot. Fail fast on missing/invalid values — never lazy.

### Api (`apps/api/src/env.ts`)

```ts
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().url().refine(/* postgres */),
  CLERK_SECRET_KEY: z.string().min(1),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  // ...
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) process.exit(1);
export const env = parsed.data;
```

`tsx watch --env-file=.env src/index.ts` loads `.env` first, then `env.ts` validates.

### Web (`apps/web/src/lib/env/{client,server}.ts`)

`t3-oss/env-nextjs` enforces:
- `client` block: only `NEXT_PUBLIC_*` vars.
- `server` block: server-only secrets (e.g. `CLERK_SECRET_KEY`).
- Build fails if either side leaks across the boundary.

`process.env.NODE_ENV` is read in `lib/env/server.ts` to expose `isDev`.

### Docker — the `NEXT_PUBLIC_API_URL` rule

`NEXT_PUBLIC_*` is **inlined at build time**. Inside Docker, the web bundle must reference the **in-container** api URL (`http://api:8080`), not the host-side `NEXT_PUBLIC_API_URL`. The compose file hardcodes the build ARG to avoid the silent failure where the web container can't reach `http://localhost:4000`. Details in the README "Docker" section.

---

## 7. Logging

### Backend (`apps/api/src/logger.ts`)

Pino single source. Level controlled by `LOG_LEVEL` env var. Format:
- Dev: `pino-pretty` (colorized, human-readable).
- Prod: JSON (one line per event).

Per-request context is attached in middleware:

```ts
// apps/api/src/index.ts
app.use('*', async (c, next) => {
  c.set('request_id', randomUUID());
  c.set('log', withRequest(request_id));      // child logger with request_id
  await next();
});

app.use('*', attachUserLogger);               // adds user_id when auth present
```

The Hono `ContextVariableMap` augmentation (`apps/api/src/types/hono-context.ts`) makes `c.set/c.get('log', …)` type-safe.

### Prisma events (`apps/api/src/lib/db/prisma-logging.ts`)

`Prisma.addHook('query', …)` writes through pino. Opt-in via `LOG_QUERIES=true`.

### Frontend (`apps/web/src/lib/logger.ts`)

Dev-only no-op:

```ts
const isDev = process.env.NODE_ENV !== 'production';
export const logger = {
  debug: (...args) => isDev && console.debug('[app/debug]', ...args),
  // ...
};
```

`ApiClient.execute()` is the single chokepoint for every api call — it logs request start, response status, and errors with no token, no body (PII safe). Useful for debugging sync loops in dev.

---

## 8. Error monitoring (GlitchTip / Sentry)

Wired by default, off unless a DSN is set. Dev never tracks (`NODE_ENV=development` hard gate).

- **api:** `apps/api/src/sentry.ts` (`initSentry()` at boot; unhandled errors in `app.onError` are captured).
- **web:** `src/instrumentation-client.ts` (browser), `sentry.server.config.ts`, `sentry.edge.config.ts`, registered by `src/instrumentation.ts`. Browser events go through the `/api/glitchtip-tunnel` route to dodge ad-blockers.
- **Privacy:** Sentry v11 `dataCollection` (everything off) + a shared `scrubEvent` (`apps/web/src/lib/sentry-scrub.ts`, mirrored in the api) strips request bodies, cookies, auth headers and IPs before sending.
- **Source maps:** disabled by default; no `SENTRY_AUTH_TOKEN` needed. See `.github/SECRETS.md` to re-enable.

---

## 9. CI/CD flow

```
feature/* (PR→dev)          test → main PR        main → dev sync
       │                          │                      │
       ▼                          ▼                      ▼
 check-branch              release-test.yml       (no-op merge)
 check-pull-request        semantic-release
 ci (lint/check/typecheck/ build+push image
      test/build)                │
                                ▼
                         Dokploy redeploy (test env)

   test push             main push           main → dev sync
        │                    │                    │
        ▼                    ▼                    ▼
 release-test.yml     release-prod.yml      dev catches up;
 (prerelease deploy)  (stable release +     cycle restarts
                       Dokploy prod)
```

Migrations run inside the api container at boot (`apps/api/docker-entrypoint.sh`). CI never runs them.

See `CONTRIBUTING.md` § 2 for the developer-side flow.

---

## 10. Files to read first

- `apps/api/src/features/users/{routes,service,repository}.ts` — the canonical feature shape (the only domain shipped with the template).
- `apps/api/src/core/{result,handle}.ts` — Result pattern.
- `apps/api/src/lib/auth/{clerk,role}.ts` — server-side auth gate.
- `apps/web/src/features/auth/{actions,role-context}.tsx` — server-action + client-side role context pattern.
- `apps/web/src/features/auth/services/auth.service.ts` — fluent api client wrapper for user endpoints.
- `packages/db/prisma.config.ts` — Prisma 7 adapter setup.
- `apps/web/CONVENTIONS.md` — frontend conventions (components, forms, pagination, errors).
- `biome.json` — single source of truth for lint + format.
- `.github/workflows/release.prod.yml` — release pipeline.