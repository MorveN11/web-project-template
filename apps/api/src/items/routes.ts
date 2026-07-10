// HTTP boundary. Each route is a thin function: parse with zod (via
// @hono/zod-openapi), hand to the service, map Result.
//
// `createRoute` defines the OpenAPI contract; `.openapi()` registers
// the same zod schemas as runtime validators — no separate `zValidator`
// chain needed. Handler bodies reuse `c.req.valid('...' )` exactly as
// before.

import { database } from '@app/db';
import { apiErrorSchema, itemDtoSchema } from '@app/shared-types';
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import type { Logger } from 'pino';
import { getAuth, requireAuth } from '../auth/clerk';
import { handleResult, handleVoid } from '../core/handle';
import { withRequest } from '../logger';
import { ItemRepository } from './repository';
import { createItemBodySchema, itemIdParamSchema, listItemsQuerySchema, updateItemBodySchema } from './schemas';
import { ItemService } from './service';

// Wire repository → service → router. Composition root for the feature.
const service = new ItemService(new ItemRepository(database));

// Per-feature auth gate. Living on the sub-router keeps the concern
// local — `index.ts` only knows it mounts an authenticated router at
// `/items`, not which middleware enforces it.
const items = new OpenAPIHono();
items.use('*', requireAuth);
items.use('*', (c, next) => {
  try {
    const auth = getAuth(c);
    const log = c.get('log') as Logger;
    c.set('log', log.child({ user_id: auth.userId } as Record<string, unknown>) as Logger);
  } catch {
    /* requireAuth already threw — let the global onError handle it */
  }
  // Re-prime the request-scoped logger on this sub-router too — the
  // request_id middleware lives on the parent app and only sets vars
  // for that instance's context.
  if (!c.get('log')) c.set('log', withRequest(c.get('request_id')));
  return next();
});

const itemListResponseSchema = z
  .object({
    items: z.array(itemDtoSchema),
    total: z.number().int(),
  })
  .openapi('ItemListResponse');

const errorResponse = {
  content: { 'application/json': { schema: apiErrorSchema } },
  description: 'error envelope',
};

const security = [{ bearerAuth: [] }];

const listRoute = createRoute({
  method: 'get',
  path: '/',
  security,
  request: { query: listItemsQuerySchema },
  responses: {
    200: { content: { 'application/json': { schema: itemListResponseSchema } }, description: 'paginated list' },
    401: errorResponse,
  },
});

const getRoute = createRoute({
  method: 'get',
  path: '/{id}',
  security,
  request: { params: itemIdParamSchema },
  responses: {
    200: { content: { 'application/json': { schema: itemDtoSchema } }, description: 'item found' },
    401: errorResponse,
    404: errorResponse,
  },
});

const createRouteDef = createRoute({
  method: 'post',
  path: '/',
  security,
  request: { body: { content: { 'application/json': { schema: createItemBodySchema } } } },
  responses: {
    201: { content: { 'application/json': { schema: itemDtoSchema } }, description: 'item created' },
    401: errorResponse,
    409: errorResponse,
  },
});

const updateRoute = createRoute({
  method: 'patch',
  path: '/{id}',
  security,
  request: {
    params: itemIdParamSchema,
    body: { content: { 'application/json': { schema: updateItemBodySchema } } },
  },
  responses: {
    200: { content: { 'application/json': { schema: itemDtoSchema } }, description: 'item updated' },
    401: errorResponse,
    403: errorResponse,
    404: errorResponse,
  },
});

const deleteRoute = createRoute({
  method: 'delete',
  path: '/{id}',
  security,
  request: { params: itemIdParamSchema },
  responses: {
    204: { description: 'item deleted' },
    401: errorResponse,
    403: errorResponse,
    404: errorResponse,
  },
});

items
  .openapi(listRoute, async (c) => {
    const query = c.req.valid('query');
    return handleResult(await service.list(query), c);
  })
  .openapi(getRoute, async (c) => {
    const { id } = c.req.valid('param');
    return handleResult(await service.getById(id), c);
  })
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

export const itemRoutes = items;
