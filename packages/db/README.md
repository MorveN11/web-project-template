# `@app/db`

Shared Postgres schema + generated Prisma types for the monorepo. The api reads + writes through this package; the web consumes **types only** (no PrismaClient runtime).

## What lives here

```
packages/db/
├── prisma/
│   ├── schema.prisma               single source of truth for all models
│   ├── seed.ts                     idempotent seed script (`pnpm db:seed`)
│   └── migrations/                  committed migration history (one folder per migration)
└── src/
    ├── client.ts                   `database` PrismaClient singleton
    ├── types.ts                    generated types re-exported for type-only consumers
    └── index.ts                    barrel
```

## Schemas at a glance

```prisma
enum Role {
  ADMIN
  CLIENT
}

model User {
  id        String    @id @default(cuid())
  clerkId   String    @unique
  email     String    @unique
  firstName String
  lastName  String
  imageUrl  String?
  role      Role      @default(CLIENT)
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  deletedAt DateTime?
  @@map("users")
}

model Item {
  id          String   @id @default(cuid())
  name        String
  description String?
  ownerId     String
  owner       User     @relation(fields: [ownerId], references: [clerkId], onDelete: Cascade)
  @@map("items")
}
```

**Why this layout**: Clerk is the source of truth for auth + identity. The local `User` row mirrors it for joins (e.g. `Item.ownerId` → `User.clerkId`). Soft-delete via `deletedAt` keeps the `Item` `Cascade` happy while preserving audit history.

## How consumers use it

```ts
// apps/api — full client access
import { database } from '@app/db';
const users = await database.user.findMany();

// apps/web — types only, no PrismaClient runtime
import type { User } from '@app/db';
function formatName(user: User) { ... }
```

The web bundle never ships `@prisma/client`. The api shares one PrismaClient process via the driver-adapter singleton in `src/client.ts`.

## Commands

| Command                                           | What it does                                         |
| ------------------------------------------------- | ---------------------------------------------------- |
| `pnpm --filter @app/db generate`                  | Re-run after every schema change                     |
| `pnpm --filter @app/db migrate:dev --name <name>` | Create + apply a migration in dev                    |
| `pnpm --filter @app/db migrate:deploy`            | Apply pending migrations (prod / docker-entrypoint)  |
| `pnpm --filter @app/db migrate:reset`             | Drop + recreate + apply all migrations (destructive) |
| `pnpm --filter @app/db studio`                    | Prisma Studio at :5555                               |
| `pnpm --filter @app/db seed`                      | Run `prisma/seed.ts`                                 |

## Workflow — when you change the schema

1. Edit `prisma/schema.prisma`.
2. `pnpm db:migrate:dev --name <descriptive_change_name>` — Prisma creates `prisma/migrations/<timestamp>_<name>/migration.sql` and applies it to your local DB.
3. **Inspect the generated SQL** in the migration folder. Prisma is good but not perfect — if the change is structural, double-check column drops / nullable changes.
4. Commit the migration. Every dev / CI / prod will pick it up via `migrate:deploy`.

> ⚠️ Never use `prisma db push` against any shared DB. It bypasses migration history. Use `migrate:dev` instead.

## Local `.env`

The api reads `DATABASE_URL` from its own env. The db package needs `DATABASE_URL` to run `prisma migrate` / `prisma generate` / `prisma seed` — keep `packages/db/.env` (gitignored) in sync with `apps/api/.env`:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5440/web_project_template?schema=public
```

## Why a shared package?

**Pros**

- One schema, one migration history.
- Field renames update types across api and web automatically.
- `pnpm db:generate` republishes types app-wide.

**Cons**

- Web bundle: tree-shaking handles `import type` correctly, but watch for accidental runtime imports.
- Native binaries (`@prisma/engines`) are now per-host, not per-app. `pnpm-workspace.yaml` `onlyBuiltDependencies` allowlist covers it.

## Migration lifecycle

1. **Dev** — `migrate:dev` creates + applies in one step.
2. **PR** — `ci.yml` doesn't run migrations. Migration files are committed; reviewers check the SQL diff.
3. **Container boot** — `apps/api/docker-entrypoint.sh` runs `pnpm db:migrate:deploy` before starting the node process. Idempotent — safe to restart.
4. **Prod rollback** — write a new migration that reverses the schema change. Never edit a deployed migration.
