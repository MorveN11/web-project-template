// PrismaClient singleton. Built with a driver adapter because `datasource.url`
// in schema.prisma was removed in Prisma 7. The api imports this; the web
// imports types only (see src/types.ts + src/index.ts re-exports).

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required to instantiate the Prisma client');
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({
    adapter,
    log: ['warn', 'error'],
  });
}

export const database = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = database;
}
