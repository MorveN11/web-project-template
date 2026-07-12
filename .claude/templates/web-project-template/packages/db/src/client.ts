// PrismaClient singleton. Built with a driver adapter because `datasource.url`
// in schema.prisma was removed in Prisma 7. The api imports this; the web
// imports types only (see src/types.ts + src/index.ts re-exports).

import { PrismaPg } from '@prisma/adapter-pg';
import { type Prisma, PrismaClient } from '@prisma/client';

// The `log` array pins the second generic on PrismaClient (U). That generic
// is what `$on<V extends U>` narrows on, and `attachPrismaLogging` needs it
// to typecheck the 'query' / 'warn' / 'error' event handlers. Pinning it
// here once, on the export type, makes the API consumers type-safe without
// each one re-stating the log options.
type AppPrisma = PrismaClient<Prisma.PrismaClientOptions, 'query' | 'warn' | 'error'>;

const globalForPrisma = globalThis as unknown as { prisma?: AppPrisma };

function createClient(): AppPrisma {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required to instantiate the Prisma client');
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({
    adapter,
    log: ['query', 'warn', 'error'],
  });
}

export const database: AppPrisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = database;
}
