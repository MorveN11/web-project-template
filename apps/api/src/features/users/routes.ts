// `/users` mount. Two sub-routers, both authenticated:
//   - `usersSelf`  → POST /me   — any signed-in user can call this
//                                to mirror their Clerk profile into
//                                the local User table.
//   - `usersAdmin` → POST /     — admin-only provisioning of new
//                                Clerk accounts (with role assignment).
// Both mount under the same `/users` path; Hono routes each request
// to the matching sub-router by `method` + `path`.
//
// Auth-related middleware (requireAuth, requireRole) lives in
// `src/auth/`. Request-logger enrichment is wired once at the app
// root in `src/index.ts`.

import { database } from '@app/db';
import { type UserRole, UserRole as UserRoleConst, userRoleSchema } from '@app/shared-types';
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { getAuth, requireAuth } from '@/auth/clerk';
import { requireRole } from '@/auth/role';
import { handleResult } from '@/core/handle';
import { authErrorResponses, conflictResponse, notFoundResponse } from '@/openapi/responses';
import { bearerSecurity } from '@/openapi/security';
import type { UserDto } from './mappers';
import { UserRepository } from './repository';
import { createUserBodySchema } from './schemas';
import { UserService } from './service';

const service = new UserService(new UserRepository(database));

const userDtoSchema = z
  .object({
    id: z.string(),
    clerkId: z.string(),
    email: z.string(),
    name: z.string().nullable(),
    role: userRoleSchema,
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('UserDto');

// ----- Self-sync + read (any signed-in user) ------------------------------

// GET /me — read the local row for the caller. Returns 404 if the
// row hasn't been mirrored yet (call POST /me first).
const getMeRoute = createRoute({
  method: 'get',
  path: '/me',
  security: bearerSecurity,
  responses: {
    200: { content: { 'application/json': { schema: userDtoSchema } }, description: 'local user row' },
    ...authErrorResponses,
    404: notFoundResponse[404],
  },
});

// POST /me — mirror Clerk profile into the local User table +
//             stamp publicMetadata on Clerk.
const syncSelfRoute = createRoute({
  method: 'post',
  path: '/me',
  security: bearerSecurity,
  responses: {
    200: { content: { 'application/json': { schema: userDtoSchema } }, description: 'user mirrored' },
    ...authErrorResponses,
    500: { description: 'sync failed' },
  },
});

const usersSelf = new OpenAPIHono();
usersSelf.use('*', requireAuth);
usersSelf
  .openapi(getMeRoute, async (c) => {
    const auth = getAuth(c);
    return handleResult(await service.getByClerkId(auth.userId), c);
  })
  .openapi(syncSelfRoute, async (c) => {
    const auth = getAuth(c);
    return handleResult(await service.syncSelf(auth), c);
  });

// ----- Admin provisioning --------------------------------------------------

const createRouteDef = createRoute({
  method: 'post',
  path: '/',
  security: bearerSecurity,
  request: { body: { content: { 'application/json': { schema: createUserBodySchema } } } },
  responses: {
    201: { content: { 'application/json': { schema: userDtoSchema } }, description: 'user created' },
    ...authErrorResponses,
    409: conflictResponse[409],
  },
});

const usersAdmin = new OpenAPIHono();
usersAdmin.use('*', requireAuth);
usersAdmin.use('*', requireRole(UserRoleConst.ADMIN));
usersAdmin.openapi(createRouteDef, async (c) => {
  const body = c.req.valid('json');
  return handleResult(await service.create(body), c, { successStatus: 201 });
});

// Compose both at `/users`. Hono dispatches each request by method+path.
export const userRoutes = new OpenAPIHono().route('/', usersSelf).route('/', usersAdmin);
export type { UserDto, UserRole };