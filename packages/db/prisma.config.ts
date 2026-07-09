// Prisma 7 config. Read by `prisma migrate`, `prisma generate`, etc.
// Connection URL lives HERE (not in schema.prisma) and is forwarded to
// the driver adapter. The runtime PrismaClient (see src/client.ts) uses
// the same adapter to talk to the database.

import 'dotenv/config';
import { defineConfig } from 'prisma/config';
import { PrismaPg } from '@prisma/adapter-pg';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required (set it in .env or the shell)');
}

const adapter = () =>
  Promise.resolve(new PrismaPg({ connectionString: process.env.DATABASE_URL }));

export default defineConfig({
  schema: './prisma/schema.prisma',
  migrations: {
    adapter,
  },
});
