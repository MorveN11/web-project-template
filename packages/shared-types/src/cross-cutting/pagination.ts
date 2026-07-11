// Pagination envelope for "list all" endpoints.
//
// `paginationResponseSchema(item, name)` returns a zod schema whose
// `items` array is typed to `item`, registered as
// `PaginationResponseOf${name}` in the OpenAPI components registry.
// Every paginated route in `apps/api/src/features/**` uses this factory
// so the wire shape is identical across features.
//
// Mirrors the C# `PagedList<T>` shape:
//   items, page, pageSize, total, totalPages, hasNextPage, hasPreviousPage
//
// Pagination metadata (page, totalPages, hasNextPage, etc.) is computed
// server-side in the feature service. Keeping the derived fields as
// plain schema fields (instead of zod `.transform()`) preserves the
// input shape in the inferred TypeScript type.

import { z } from '@hono/zod-openapi';

export function paginationResponseSchema<T extends z.ZodTypeAny>(item: T, name: string) {
  return z
    .object({
      items: z.array(item),
      page: z.number().int().min(1),
      pageSize: z.number().int().min(1),
      total: z.number().int().min(0),
      totalPages: z.number().int().min(0),
      hasNextPage: z.boolean(),
      hasPreviousPage: z.boolean(),
    })
    .openapi(`PaginationResponseOf${name}`);
}

export type PaginationResponse<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};