// Zod schemas drive both runtime validation (via @hono/zod-openapi) and
// TypeScript types via `z.infer`. The route layer never hand-rolls type
// guards — every payload is parsed here.
//
// `.openapi('Name')` tags each schema so `@hono/zod-openapi` route
// definitions can reference them by name in the generated OpenAPI doc.

import { z } from '@hono/zod-openapi';

export const itemIdParamSchema = z
  .object({
    id: z.string().min(1).max(64),
  })
  .openapi('ItemIdParam');

export const createItemBodySchema = z
  .object({
    name: z.string().min(1).max(120),
    description: z.string().max(2000).optional(),
  })
  .openapi('CreateItemBody');

export const updateItemBodySchema = createItemBodySchema.partial().openapi('UpdateItemBody');

export const listItemsQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .openapi('ListItemsQuery');

export type ItemIdParam = z.infer<typeof itemIdParamSchema>;
export type CreateItemBody = z.infer<typeof createItemBodySchema>;
export type UpdateItemBody = z.infer<typeof updateItemBodySchema>;
export type ListItemsQuery = z.infer<typeof listItemsQuerySchema>;
