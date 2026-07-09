# @app/db

Shared Postgres schema + generated Prisma types for the monorepo.

## What lives here

- `prisma/schema.prisma` — single source of truth for all models.
- `prisma/seed.ts` — idempotent seed script.
- `src/client.ts` — `database` (PrismaClient singleton). Used by the api.
- `src/types.ts` — generated types re-exported for type-only consumers.
- `src/index.ts` — barrel.

## How consumers use it

```ts
// apps/api — full client access
import { database } from '@app/db';
const users = await database.user.findMany();

// apps/web — type only, no PrismaClient runtime
import type { User } from '@app/db';
function formatName(user: User) { ... }
```

The web's bundle never ships `@prisma/client`. The api does, but it
shares the same PrismaClient process with the rest of the backend so
there is no second driver.

## Commands

```bash
pnpm --filter @app/db generate          # run after every schema change
pnpm --filter @app/db migrate:dev       # local: create + apply a migration
pnpm --filter @app/db migrate:deploy    # prod: apply pending migrations
pnpm --filter @app/db studio            # Prisma Studio at :5555
pnpm --filter @app/db seed              # run prisma/seed.ts
```

## Why a shared package?

Pros:
- One schema, one migration history.
- Field renames update types across `api` and `web` automatically.
- A single `pnpm db:generate` republishes types app-wide.

Cons:
- Web bundle: tree-shaking handles type-only imports correctly (must
  use `import type`), but watch for accidental runtime imports.
- Native binaries (`@prisma/engines`) are now per-host, not per-app;
  the `pnpm-workspace.yaml` `onlyBuiltDependencies` allowlist covers
  it.
