// Prisma 7 config. Read by `prisma migrate`, `prisma generate`, etc.
// Connection URL for Migrate lives HERE (schema.prisma dropped `datasource.url`).
// The runtime PrismaClient (see src/client.ts) still needs its own driver adapter.
//
// DATABASE_URL is required for commands that touch the database (migrate,
// db push, studio, db execute). It is NOT required for `prisma generate`
// (which only reads the schema). The postinstall script in apps/api runs
// `prisma generate` and that must succeed in CI where DATABASE_URL is
// not set.
//
// Plain JS (not TS) so the slim runtime image can run `node .../prisma/build/index.js`
// directly — no tsx/ts-node required at runtime.
//
// We use `process.env.*` directly instead of prisma's `env()` helper
// because the helper THROWS on missing vars. The Docker build runs
// `prisma generate` before DATABASE_URL is in scope (it's only in
// the container's runtime environment, not in the build stage's env),
// so a strict check would fail the build. dotenv loads any .env file
// present at the cwd — for local dev, mount apps/api/.env at
// packages/db/.env or run `pnpm --filter @app/db migrate` from a
// shell where .env is loaded.
//
// Migrations prefer `DIRECT_URL` when set so Neon deployments hit
// the direct endpoint (Neon's pooler rejects DDL transactions).
// Docker dev leaves DIRECT_URL empty → falls back to DATABASE_URL.

import 'dotenv/config';
import { defineConfig } from 'prisma/config';

const database_url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

export default defineConfig({
  schema: './prisma/schema.prisma',
  migrations: {
    // The api's `build` script bundles `packages/db/prisma/seed.ts`
    // (and its `@clerk/backend` + `@app/shared-types` deps) into a
    // single ESM file at `apps/api/dist/seed.js`. Running it with
    // plain `node` here means the slim api image needs neither `tsx`
    // nor those workspace deps in node_modules.
    seed: 'node apps/api/dist/seed.js',
  },
  // `datasource.url` is only required by migrate/db push/studio. We
  // pass it when present and let prisma error on its own when missing
  // for those commands.
  ...(database_url ? { datasource: { url: database_url } } : {}),
});
