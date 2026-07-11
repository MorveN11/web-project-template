// Item wire shape — the `ItemDto` returned by the items feature.
//
// Used by the api's `itemDtoSchema` (registered automatically via
// `.openapi('ItemDto')` in this file) and by the web's typed
// `apiClient.get<PaginationResponse<ItemDto>>('/items')` calls.
//
// The schema mirrors the Prisma row shape from
// `apps/api/src/items/mappers.ts` (`toItemDto` keeps these in sync).
// Date fields are serialized as ISO strings on the wire.

import { z } from '@hono/zod-openapi';

export const itemDtoSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    ownerId: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('ItemDto');

export type ItemDto = z.infer<typeof itemDtoSchema>;