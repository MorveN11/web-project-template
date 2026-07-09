// Zod schemas drive both runtime validation (via @hono/zod-validator)
// and TypeScript types via `z.infer`. The route layer never hand-rolls
// type guards — every payload is parsed here.

import { z } from 'zod';

export const itemIdParamSchema = z.object({
  id: z.string().min(1).max(64),
});

export const createItemBodySchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
});

export const updateItemBodySchema = createItemBodySchema.partial();

export const listItemsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ItemIdParam = z.infer<typeof itemIdParamSchema>;
export type CreateItemBody = z.infer<typeof createItemBodySchema>;
export type UpdateItemBody = z.infer<typeof updateItemBodySchema>;
export type ListItemsQuery = z.infer<typeof listItemsQuerySchema>;
