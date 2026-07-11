// Wire error envelope used by every 4xx/5xx response across the api.
//
// Matches the envelope emitted by `apps/api/src/core/handle.ts`
// (`handleResult`) and the global `app.onError` in `apps/api/src/index.ts`.
// Both api and web reference this schema so the error shape stays in
// lock-step across the network boundary.

import { z } from '@hono/zod-openapi';

export const apiErrorSchema = z
  .object({
    error: z.object({
      code: z.string(),
      message: z.string(),
    }),
  })
  .openapi('ApiError');

export type ApiErrorBody = z.infer<typeof apiErrorSchema>;