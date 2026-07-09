// Shared zod schemas + inferred types between apps/api and apps/web.
// Keep this package dependency-free beyond `zod`.

export { z } from 'zod';

// Re-export the schemas your features actually need. The items example
// below mirrors apps/api/src/items/schemas.ts so the web client can
// validate payloads before crossing the network.
import { z } from 'zod';

export const itemDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  ownerId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type ItemDto = z.infer<typeof itemDtoSchema>;

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});

export type ApiErrorBody = z.infer<typeof apiErrorSchema>;
