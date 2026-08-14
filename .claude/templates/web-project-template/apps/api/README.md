# `@app/api`

Hono 4 backend. Stateless — all persistent state lives in Postgres (via `@app/db`) and Clerk (identity). Designed to run in a single Node process per replica, scaled horizontally behind a load balancer.

## Run

```bash
pnpm dev:api                  # tsx watch, hot reload, loads apps/api/.env
```

Health check: `curl http://localhost:4000/health` → `{"status":"ok",...}`.
OpenAPI 3.1 spec: `curl http://localhost:4000/openapi.json | jq`.
Interactive docs (dev only): `http://localhost:4000/docs` (Scalar).

## Layout

```
apps/api/src/
├── index.ts                     boot — wires middleware + mounts routers
├── env.ts                       runtime env validation (zod, fail-fast)
├── logger.ts                    pino setup + child-logger helpers
├── auth/                        shared auth infrastructure
│   ├── clerk.ts                 verifyToken, requireAuth, attachUserLogger, getAuth
│   └── role.ts                  requireRole(UserRole.ADMIN | CLIENT)
├── core/                        shared error + Result helpers
│   ├── handle.ts                handleResult / handleVoid
│   └── result.ts                Result<T>, AppError, err* factories
├── db/                          Prisma logging adapter
├── openapi/                     shared OpenAPI primitives (reused by every feature)
│   ├── security.ts              publicSecurity, bearerSecurity
│   └── responses.ts             authErrorResponses, conflictResponse, notFoundResponse, …
├── scalar/                      /docs page presentation
├── types/                       Hono context augmentation (typed c.get/c.set)
└── features/                    one folder per domain
    ├── health/                  GET /health
    ├── items/                   public reads + admin writes (split router)
    ├── users/                   self-sync + admin provisioning (split router)
    └── webhooks/                Svix-verified Clerk webhook receiver
```

## Conventions

### 1. Result<T>, not throw

Every service method returns `Result<T>` (`ok(value)` or `err(AppError)`). Throws never leak across the wire.

```ts
async list(q: ListQuery): Promise<Result<PaginationResponse<ItemDto>>> {
  try {
    const [rows, total] = await Promise.all([this.items.list(q), this.items.count()]);
    return ok({ items: rows.map(toItemDto), total, /* computed page metadata */ });
  } catch (cause) {
    return err(errInternal(cause));
  }
}
```

Errors are typed via `errBadRequest | errUnauthorized | errForbidden | errNotFound | errConflict | errInternal(cause)`. The route's handler is always two lines:

```ts
.openapi(listRoute, async (c) => {
  const query = c.req.valid('query');
  return handleResult(await service.list(query), c);
});
```

`handleResult` reads `result.data` on success and emits the wire envelope `{ error: { code, message } }` with the right status code on failure.

### 2. OpenAPI from zod

Every route declares its request + response via zod schemas. `createRoute` from `@hono/zod-openapi` registers them automatically.

```ts
const createRouteDef = createRoute({
  method: 'post',
  path: '/',
  security: bearerSecurity,
  request: {
    body: { content: { 'application/json': { schema: createUserBodySchema } } },
  },
  responses: {
    201: { content: { 'application/json': { schema: userDtoSchema } }, description: 'user created' },
    ...authErrorResponses,         // 401 + 403 spread
    409: conflictResponse[409],
  },
});
```

Reusable constants live in `src/openapi/`. New shared responses → add to `responses.ts`. Don't redefine inline.

### 3. Features folder layout

Each feature has the same file shape:

```
features/<name>/
├── routes.ts       OpenAPIHono routers + createRoute definitions
├── schemas.ts      zod request/response schemas (request bodies + params)
├── service.ts      Result<T> business logic + Clerk BAPI calls
├── repository.ts   fluent facade over Prisma (query shapes only)
├── mappers.ts      Prisma row → wire DTO conversion
└── index.ts        barrel + file-role comment
```

The route is **the only file that knows about HTTP**. Service and repository are pure TS, testable in isolation.

### 4. Auth — layered, never duplicated

| Layer | Lives in | Purpose |
| --- | --- | --- |
| **Mount gate** | `src/index.ts` — `app.use(...)` | request_id, access log, CORS, attachUserLogger |
| **JWT verification** | `src/auth/clerk.ts` — `requireAuth` middleware | Verify Bearer token via `@clerk/backend`; sets `c.set('auth', ...)` |
| **Role enforcement** | `src/auth/role.ts` — `requireRole(roles)` | Throws 403 if `auth.role` not in allowed list |
| **Result mapping** | `src/core/handle.ts` — `handleResult` | Converts Result<T> to Response; respects the status from `AppError` |

Apply the middleware chain in `features/<name>/routes.ts`:

```ts
const admin = new OpenAPIHono();
admin.use('*', requireAuth);
admin.use('*', requireRole(UserRole.ADMIN));
admin.openapi(protectedRoute, handler);
```

### 5. Clerk BAPI writes are server-only

`clerk.users.updateUserMetadata(...)` and friends are called only from `src/features/users/service.ts` and `src/dev/routes.ts`. The web app never holds `CLERK_SECRET_KEY`. The split exists because BAPI requires the service-role key.

### 6. Clerk-user memo (L1 in-process + L2 Redis)

`src/auth/clerk.ts` does NOT call `clerkClient.users.getUser(sub)` directly — it goes through `getClerkUserCached(sub)` from `src/cache/clerk-user.ts`. Two-layer cache:

- **L1** — `Map<sub, { user, expiresAt }>` per-process, FIFO eviction at 1000 entries, 30s TTL.
- **L2** — Redis (key `clerk:user:v1:<sub>`, 30s TTL). Shared across api instances, so horizontal scale-out doesn't refetch on every cold replica.

Redis is **optional**. If `getRedis()` returns `null` (unreachable), the wrapper falls back to L1 and logs a warn — no 5xx to the client. Call `invalidateClerkUserCached(sub)` after mutating `privateMetadata.role` so the next request re-reads from Clerk instead of waiting out the TTL.

### 7. Webhook handling — verify, dispatch, ack

`src/features/webhooks/routes.ts` is a **single** `handleClerkWebhook(request)` handler:

1. `verifyWebhook(request)` from `@clerk/backend/webhooks` — throws on bad Svix signature.
2. Switch on `evt.type` and dispatch to the service.
3. Always return 2xx (success) or 4xx (verification failure). 5xx triggers Svix retry — only on real errors.

Idempotency lives in the service (every handler is `findUnique` then `upsert`/`delete`).

## Error envelope

Every error response uses the same shape (matches `@app/shared-types` `apiErrorSchema`):

```json
{
  "error": {
    "code": "forbidden",
    "message": "requires role: ADMIN"
  }
}
```

`code` is stable (programmatic identifier), `message` is human-readable. Never include stack traces in production responses.

## Commands

| Command | What it does |
| --- | --- |
| `pnpm --filter @app/api dev` | Watch + reload + load `.env` |
| `pnpm --filter @app/api typecheck` | tsc --noEmit against `tsconfig.build.json` |
| `pnpm --filter @app/api lint` | Biome |
| `pnpm --filter @app/api build` | tsc → `dist/` |
| `pnpm --filter @app/api test` | Vitest (currently no tests; pass-with-no-tests) |
| `docker compose -f docker-compose.prod.yml --env-file .env build api` | Docker image |

## Env vars (validated at boot — see `src/env.ts`)

| Var | Required | Default | Purpose |
| --- | --- | --- | --- |
| `NODE_ENV` | — | `development` | drives logger verbosity + dev-only mounts |
| `PORT` | — | `4000` | bind port (container uses `8080` via env override) |
| `LOG_LEVEL` | — | `info` | pino level |
| `LOG_QUERIES` | — | `false` | Prisma query event logging |
| `DATABASE_URL` | ✓ | — | Postgres connection string |
| `CORS_ORIGIN` | — | `http://localhost:3000` | comma-separated allowed origins |
| `CLERK_SECRET_KEY` | ✓ | — | Clerk service-role key (BAPI + JWT verify) |
| `CLERK_PUBLISHABLE_KEY` | — | `""` | Clerk pk |
| `CLERK_AUTHORIZED_PARTIES` | — | `http://localhost:3000` | comma-separated allowed `azp` origins for SDK-minted JWTs |
| `CLERK_WEBHOOK_SIGNING_SECRET` | ✓ | `whsec_…` | Svix signing secret from Clerk dashboard |
| `SEED_ENABLED` | — | `false` | whether the entrypoint runs `prisma db seed` after migrations |

Boots fail-fast if any required var is missing or malformed (`process.exit(1)` after a single stderr dump).

## Dockerfile

Three-stage: `deps` (pnpm install, --ignore-scripts) → `build` (prisma generate + tsc) → `runner` (corepack pnpm + node + tsx). The runtime port is `8080` (host port mapping is in `docker-compose.prod.yml`).

Entry point: `apps/api/docker-entrypoint.sh` runs `pnpm db:migrate:deploy` (then `pnpm db:seed` if `SEED_ENABLED=true`), then `exec` the node process. Idempotent — safe to restart the container at any time.

## Adding a new feature — the recipe

1. **Create the folder** `src/features/<name>/` with the file layout above.
2. **Add Prisma model** if needed (in `packages/db/prisma/schema.prisma` → `pnpm db:migrate:dev`).
3. **Add a zod request schema** in `packages/shared-types/src/features/<name>.ts` — single source of truth, consumed by both apps.
4. **Wire the route**:
   ```ts
   const public = new OpenAPIHono();
   public.openapi(listRoute, async (c) => handleResult(await service.list(c.req.valid('query')), c));

   const admin = new OpenAPIHono();
   admin.use('*', requireAuth);
   admin.use('*', requireRole(UserRoleConst.ADMIN));
   admin.openapi(createRoute, handler);

   export const myRoutes = new OpenAPIHono().route('/', public).route('/', admin);
   ```
5. **Mount in `src/index.ts`**: `app.route('/mything', myRoutes);`
6. **Verify** with `pnpm typecheck && pnpm --filter @app/api build && curl http://localhost:4000/openapi.json | jq .paths`.

The boilerplate handles the rest: Scalar picks up the route, the CI lints it, the docs update automatically.
