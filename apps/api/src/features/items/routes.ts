// HTTP boundary. Each route is a thin function: parse with zod (via
// @hono/zod-openapi), hand to the service, map Result.
//
// `createRoute` defines the OpenAPI contract; `.openapi()` registers
// the same zod schemas as runtime validators — no separate `zValidator`
// chain needed. Handler bodies reuse `c.req.valid('...' )` exactly as
// before.
//
// Split into TWO OpenAPIHono routers mounted at the same path:
//   - `itemsPublic`  → list + getById   (no auth, browseable)
//   - `itemsAdmin`   → create + patch + delete (requireAuth +
//                       requireRole(UserRole.ADMIN))
// Hono routes each request to the matching instance, so the public
// reads stay open while mutations are gated.
//
// Auth-related middleware (requireAuth, requireRole) lives in
// `src/auth/`. Request-logger enrichment is wired once at the app
// root in `src/index.ts` — feature routers no longer declare it.

import { database } from '@app/db';
import { itemDtoSchema, paginationResponseSchema, UserRole } from '@app/shared-types';
import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { getAuth, requireAuth } from '@/auth/clerk';
import { requireRole } from '@/auth/role';
import { handleResult, handleVoid } from '@/core/handle';
import { authErrorResponses, conflictResponse, notFoundResponse } from '@/openapi/responses';
import { bearerSecurity, publicSecurity } from '@/openapi/security';
import { ItemRepository } from './repository';
import { createItemBodySchema, itemIdParamSchema, listItemsQuerySchema, updateItemBodySchema } from './schemas';
import { ItemService } from './service';

// Wire repository → service → router. Composition root for the feature.
const service = new ItemService(new ItemRepository(database));

const itemListResponseSchema = paginationResponseSchema(itemDtoSchema, 'Item');

// ----- Public reads --------------------------------------------------------

const listRoute = createRoute({
  method: 'get',
  path: '/',
  security: publicSecurity,
  request: { query: listItemsQuerySchema },
  responses: {
    200: { content: { 'application/json': { schema: itemListResponseSchema } }, description: 'paginated list' },
  },
});

const getRoute = createRoute({
  method: 'get',
  path: '/{id}',
  security: publicSecurity,
  request: { params: itemIdParamSchema },
  responses: {
    200: { content: { 'application/json': { schema: itemDtoSchema } }, description: 'item found' },
    404: notFoundResponse[404],
  },
});

const itemsPublic = new OpenAPIHono();
itemsPublic
  .openapi(listRoute, async (c) => {
    const query = c.req.valid('query');
    return handleResult(await service.list(query), c);
  })
  .openapi(getRoute, async (c) => {
    const { id } = c.req.valid('param');
    return handleResult(await service.getById(id), c);
  });

// ----- Admin writes -------------------------------------------------------

const createRouteDef = createRoute({
  method: 'post',
  path: '/',
  security: bearerSecurity,
  request: { body: { content: { 'application/json': { schema: createItemBodySchema } } } },
  responses: {
    201: { content: { 'application/json': { schema: itemDtoSchema } }, description: 'item created' },
    ...authErrorResponses,
    409: conflictResponse[409],
  },
});

const updateRoute = createRoute({
  method: 'patch',
  path: '/{id}',
  security: bearerSecurity,
  request: {
    params: itemIdParamSchema,
    body: { content: { 'application/json': { schema: updateItemBodySchema } } },
  },
  responses: {
    200: { content: { 'application/json': { schema: itemDtoSchema } }, description: 'item updated' },
    ...authErrorResponses,
    404: notFoundResponse[404],
  },
});

const deleteRoute = createRoute({
  method: 'delete',
  path: '/{id}',
  security: bearerSecurity,
  request: { params: itemIdParamSchema },
  responses: {
    204: { description: 'item deleted' },
    ...authErrorResponses,
    404: notFoundResponse[404],
  },
});

const itemsAdmin = new OpenAPIHono();
itemsAdmin.use('*', requireAuth);
itemsAdmin.use('*', requireRole(UserRole.ADMIN));
itemsAdmin
  .openapi(createRouteDef, async (c) => {
    const auth = getAuth(c);
    const body = c.req.valid('json');
    return handleResult(await service.create(auth, body), c, { successStatus: 201 });
  })
  .openapi(updateRoute, async (c) => {
    const auth = getAuth(c);
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    return handleResult(await service.update(auth, id, body), c);
  })
  .openapi(deleteRoute, async (c) => {
    const auth = getAuth(c);
    const { id } = c.req.valid('param');
    return handleVoid(await service.remove(auth, id), c);
  });

// Both routers mount at `/items`; Hono routes each request to the
// matching instance. `itemRoutes` is the type `Hono` accepts on
// `app.route('/items', itemRoutes)` — exporting a small wrapper keeps
// the call site readable.
export const itemRoutes = new OpenAPIHono().route('/', itemsPublic).route('/', itemsAdmin);
