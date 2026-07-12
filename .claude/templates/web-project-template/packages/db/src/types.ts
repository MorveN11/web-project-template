// Type re-exports. The web imports from here so generated Prisma types
// (User, Role, etc.) flow across the monorepo without bundling the
// PrismaClient runtime into the browser.
//
// The `Prisma` value namespace is exported separately from ./index so
// consumers can do `import { Prisma } from '@app/db'` for hooks like
// `Prisma.addHook(...)`. We don't re-export `Prisma` as a type here
// because the same name is used for the value namespace, which would
// trigger a `Duplicate identifier 'Prisma'` error in the barrel.

import type { PrismaClient } from '@prisma/client';

export type { Role, User } from '@prisma/client';

export type Database = PrismaClient;
