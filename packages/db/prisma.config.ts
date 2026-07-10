// Prisma 7 config. Read by `prisma migrate`, `prisma generate`, etc.
// Connection URL for Migrate lives HERE (schema.prisma dropped `datasource.url`).
// The runtime PrismaClient (see src/client.ts) still needs its own driver adapter.

import 'dotenv/config';
import { defineConfig } from 'prisma/config';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required (set it in .env or the shell)');
}

export default defineConfig({
  schema: './prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
