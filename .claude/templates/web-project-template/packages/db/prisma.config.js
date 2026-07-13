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

import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: './prisma/schema.prisma',
  migrations: {
    seed: 'tsx prisma/seed.ts',
  },
  // `datasource.url` is only required by migrate/db push/studio. We
  // pass it when present and let prisma error on its own when missing
  // for those commands.
  ...(process.env.DATABASE_URL ? { datasource: { url: process.env.DATABASE_URL } } : {}),
});
