// Two-role system: ADMIN (full access, can create users via the api)
// and CLIENT (default for self-signup). Mirrors the Prisma `Role` enum
// in `packages/db/prisma/schema.prisma` — keep all three in lock-step.
//
// `UserRole` is the TS const object + type. `userRoleSchema` is the
// zod validator used by api request bodies (createUserBodySchema)
// and the auth feature's role middleware (requireRole(UserRole.ADMIN)).

import { z } from '@hono/zod-openapi';

export const UserRole = {
  ADMIN: 'ADMIN',
  CLIENT: 'CLIENT',
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const userRoleSchema = z.enum([UserRole.ADMIN, UserRole.CLIENT]).openapi('UserRole');
