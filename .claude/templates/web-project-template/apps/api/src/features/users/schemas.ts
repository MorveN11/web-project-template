// Zod schemas for the users module. Tag every schema with `.openapi()`
// so `@hono/zod-openapi` route definitions can reference them by name.

import { UserRole } from '@app/shared-types';
import { z } from '@hono/zod-openapi';

export const createUserBodySchema = z
  .object({
    email: z.email(),
    firstName: z.string().min(1).max(120),
    lastName: z.string().min(1).max(120),
    // Optional — Clerk only fills imageUrl if the user has uploaded
    // an avatar or signed in via a provider (Google, GitHub) that
    // ships one. Stored as `null` when missing.
    imageUrl: z.url().max(2000).nullable().optional(),
    password: z.string().min(8).max(120),
    role: z.enum([UserRole.ADMIN, UserRole.CLIENT]),
  })
  .openapi('CreateUserBody');

export type CreateUserBody = z.infer<typeof createUserBodySchema>;
