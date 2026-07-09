// HTTP boundary. Each route is a thin function: parse with zod, hand
// to the service, map Result.

import { database } from '@app/db';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { getAuth } from '../auth/clerk';
import { handleResult, handleVoid } from '../core/handle';
import { ItemRepository } from './repository';
import { createItemBodySchema, itemIdParamSchema, listItemsQuerySchema, updateItemBodySchema } from './schemas';
import { ItemService } from './service';

// Wire repository → service → router. Composition root for the feature.
const service = new ItemService(new ItemRepository(database));

const items = new Hono()
  .get('/', zValidator('query', listItemsQuerySchema), async (c) => {
    const query = c.req.valid('query');
    return handleResult(await service.list(query), c);
  })
  .get('/:id', zValidator('param', itemIdParamSchema), async (c) => {
    const { id } = c.req.valid('param');
    return handleResult(await service.getById(id), c);
  })
  .post('/', zValidator('json', createItemBodySchema), async (c) => {
    const auth = getAuth(c);
    const body = c.req.valid('json');
    return handleResult(await service.create(auth, body), c, { successStatus: 201 });
  })
  .patch('/:id', zValidator('param', itemIdParamSchema), zValidator('json', updateItemBodySchema), async (c) => {
    const auth = getAuth(c);
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    return handleResult(await service.update(auth, id, body), c);
  })
  .delete('/:id', zValidator('param', itemIdParamSchema), async (c) => {
    const auth = getAuth(c);
    const { id } = c.req.valid('param');
    return handleVoid(await service.remove(auth, id), c);
  });

export const itemRoutes = items;
