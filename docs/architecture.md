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
└── .github/
    ├── workflows/           check-branch, check-pull-request, ci, release.{prod,test}
    └── CODEOWNERS           auto-requested reviewers per path
```

`pnpm-workspace.yaml` declares workspaces. **Root has zero devDependencies** — every tool (Biome, vitest, prisma, tsx) lives in the package that uses it.

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
errNotFound('item 42 not found')     // { code: 'not_found', status: 404, ... }
errForbidden('not your item')          // { code: 'forbidden', status: 403, ... }
```

`handleResult` (`apps/api/src/core/handle.ts`) translates a `Result<T>` into a Hono response:

```ts
handleResult(await service.list(query), c)
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
│  getCurrentToken()                 │
│  safeAction(() => getMyProfile())  │
└──────────────┬─────────────────────┘
               │
               ▼
┌────────────────────────────────────┐
│ Service layer                      │  ← thin fetch wrapper
│ features/<x>/services/<x>.service  │
│  apiClient.get('/v1/me')           │
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

`apps/web/src/lib/logger.ts` is a no-op in production (`process.env.NODE_ENV` inlined at build). Use it for debugging during development; production observability comes from the api's structured logs.

---

## 4. Database (`packages/db`)

### Prisma 7 adapter pattern

Prisma 7 removed `datasource.url` from `schema.prisma`. Connection URL lives in `packages/db/prisma.config.ts`:

```ts
// prisma.config.ts
import 'dotenv/config';
import { defineConfig } from 'prisma/config';
import { PrismaPg } from '@prisma/adapter-pg';

export default defineConfig({
  schema: './prisma/schema.prisma',
  migrations: {
    adapter: () => Promise.resolve(new PrismaPg({
      connectionString: process.env.DATABASE_URL!,
    })),
  },
});
```

The runtime `PrismaClient` uses the same adapter:

```ts
// packages/db/src/client.ts
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
export const database = new PrismaClient({ adapter, log: ['warn', 'error'] });
```

### Public surface (`@app/db`)

```ts
// api code (runtime + types):
import { database, Prisma, type User } from '@app/db';

// web code (types only — never the runtime):
import type { User } from '@app/db';
```

The runtime is a single `PrismaClient` shared across the api. Web only consumes types — the postgres runtime never reaches the browser bundle.

### Migrations

- Dev: `pnpm db:migrate:dev` — creates + applies.
- Prod: `apps/api/docker-entrypoint.sh` runs `prisma migrate deploy` on container boot. **Migrations are never run in CI** (CI has no postgres service).

---

## 5. Auth (`@clerk/nextjs` v7+)

```
                  Bearer JWT
   Browser ─────────────────► Hono api
                                 │
                                 ▼
                       ┌──────────────────┐
                       │ auth/clerk.ts    │
                       │ verifyClerkToken │
                       │   jose.jwtVerify │
                       │   JWKS from Clerk │
                       └────────┬─────────┘
                                │ ctx = { userId, sessionId, claims }
                                ▼
                       service.ts has ClerkAuthContext
```

The api verifies JWTs with `@clerk/nextjs` removed from earlier; we use `jose` directly to avoid coupling.

Frontend uses `@clerk/nextjs` server functions (`auth()`, `currentUser()`) for RSC auth checks, and `SignInButton` / `UserButton` for client UI.

`proxy.ts` (Next.js middleware) uses `clerkMiddleware` to gate every non-public route via `auth.protect()`.

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
  CORS_ORIGIN: z.string().default('http://localhost:3000').transform(csv),
  // ...
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  process.stderr.write(/* reason */);
  process.exit(1);
}
export const env = parsed.data;
```

`tsx watch --env-file=.env src/index.ts` loads `.env` first, then env.ts validates.

### Web (`apps/web/src/lib/env/{client,server}.ts`)

`t3-oss/env-nextjs` enforces:
- `client` block: only `NEXT_PUBLIC_*` vars.
- `server` block: server-only secrets (e.g. `CLERK_SECRET_KEY`).
- Build fails if either side leaks across the boundary.

`process.env.NODE_ENV` is read in `lib/env/server.ts` to expose `isDev`.

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

app.use('v1/*', async (c, next) => {
  const log = c.get('log') as Logger;
  c.set('log', log.child({ user_id: auth.userId }));   // add user_id
  await next();
});
```

The Hono `ContextVariableMap` augmentation (`apps/api/src/types/hono-context.ts`) makes `c.set/c.get('log', …)` type-safe.

### Prisma events (`apps/api/src/db/prisma-logging.ts`)

`Prisma.addHook('query', …)` writes through pino. Opt-in via `LOG_QUERIES=true`.

### Frontend (`apps/web/src/lib/logger.ts`)

Dev-only noop:

```ts
const isDev = process.env.NODE_ENV !== 'production';
export const logger = {
  debug: (...args) => isDev && console.debug('[app/debug]', ...args),
  // ...
};
```

---

## 8. CI/CD flow

```
PR opened (any branch)        PR merged to test         PR merged to main
       │                              │                       │
       ▼                              ▼                       ▼
 check-branch                    release.test.yml      release.prod.yml
 check-pull-request             semantic-release       semantic-release
 ci (lint/test/build)            build+push image       build+push image
                                       │                       │
                                       ▼                       ▼
                                Dokploy redeploy        Dokploy redeploy
                                (test env)              (prod env)
```

Migrations run inside the api container at boot (`apps/api/docker-entrypoint.sh`). CI never runs them.

See `CONTRIBUTING.md` § 4 for the developer-side flow.

---

## 9. Files to read first

- `apps/api/src/items/{routes,service,repository}.ts` — the canonical feature shape.
- `apps/api/src/core/{result,handle}.ts` — Result pattern.
- `apps/web/src/features/profile/actions.ts` — server-action pattern.
- `packages/db/prisma.config.ts` — Prisma 7 adapter setup.
- `.github/workflows/release.prod.yml` — release pipeline.