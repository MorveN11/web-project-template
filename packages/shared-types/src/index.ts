// Shared zod schemas + inferred types between apps/api and apps/web.
// Keep this package dependency-free beyond `zod`.

export { z } from 'zod';

// Re-export the schemas your features actually need. The items example
// below mirrors apps/api/src/items/schemas.ts so the web client can
// validate payloads before crossing the network.
//
// `.openapi('Name')` registers the schema in zod-to-openapi's component
// registry so `@hono/zod-openapi` routes can reference it by name in
// their response bodies. Importing `@hono/zod-openapi` here also
// augments zod with the `.openapi()` method at the type level.
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

export const apiErrorSchema = z
  .object({
    error: z.object({
      code: z.string(),
      message: z.string(),
    }),
  })
  .openapi('ApiError');

export type ApiErrorBody = z.infer<typeof apiErrorSchema>;
