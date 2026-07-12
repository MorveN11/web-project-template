// Public surface of @app/db.
//
// - api code:  `import { database, Prisma } from '@app/db'`   (Prisma runtime for hooks)
// - api code:  `import type { Database } from '@app/db'`       (typed shape for DI)
// - web code:  `import type { User } from '@app/db'`           (type only, no runtime cost)
//
// Splitting types vs runtime keeps postgres off the web bundle.

export { Prisma } from '@prisma/client';
export { database } from './client';
export type { Database, Role, User } from './types';
