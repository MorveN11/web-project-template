# `@app/shared-types`

Zod schemas + inferred TypeScript types shared between `apps/api` and `apps/web`. **Single source of truth for the wire shape** — both apps import from this package; the api registers the schemas with `@hono/zod-openapi`, the web reads the inferred types for typed `apiClient` wrappers.

Keep this package dependency-free beyond `zod` + `@hono/zod-openapi` (the latter is only needed for the `.openapi('Name')` augmentation that registers each schema in zod-to-openapi's component registry).

## Layout

```
packages/shared-types/src/
├── index.ts                  barrel — re-exports the public surface
├── cross-cutting/            used by ≥ 2 features
│   ├── api-error.ts          apiErrorSchema + ApiErrorBody  (4xx/5xx envelope)
│   └── pagination.ts         paginationResponseSchema(item, name) factory + PaginationResponse<T>
└── features/                 one per domain DTO
    ├── item.ts               itemDtoSchema + ItemDto
    └── user.ts               UserRole const + type + userRoleSchema
```

| Layer | What goes here |
| --- | --- |
| `cross-cutting/` | Concerns used by ≥ 2 features (error envelope, pagination, …) |
| `features/` | One file per domain DTO. Schema + inferred type live together. |

If you're adding a new schema and you can't decide where: put it under `features/<name>.ts`. Move it to `cross-cutting/` when a second feature needs it.

## Conventions

### Schema + type in the same file

Each leaf file owns **both** the zod schema AND the inferred TS type. No jumping around:

```ts
// features/user.ts
export const userRoleSchema = z.enum([UserRole.ADMIN, UserRole.CLIENT]).openapi('UserRole');
export type UserRole = (typeof UserRole)[keyof typeof UserRole];
//                     ^^^^^ same name — enum const + type share the identifier

export const itemDtoSchema = z.object({ ... }).openapi('ItemDto');
export type ItemDto = z.infer<typeof itemDtoSchema>;
```

### Always `.openapi('Name')`

Every schema gets a stable name. The api's `@hono/zod-openapi` registry uses it in `/openapi.json` so the Scalar UI lists the components cleanly.

### Pagination factory

Don't redefine `{ items: [...], total: number }` per feature. Use the factory:

```ts
import { paginationResponseSchema } from '@app/shared-types/cross-cutting/pagination';
import { itemDtoSchema } from '@app/shared-types/features/item';

// In your route definition:
const itemListResponseSchema = paginationResponseSchema(itemDtoSchema, 'Item');
//                                          ^^^^^^ item schema
//                                                          ^^^^ unique name suffix
// → registered as `PaginationResponseOfItem` in components
// → wire shape: { items: ItemDto[], page, pageSize, total, totalPages,
//                 hasNextPage, hasPreviousPage }
```

The factory uses `<T>` generics so `items` is correctly typed (e.g. `ItemDto[]`, not `unknown[]`).

### Don't put runtime logic here

Schemas + types only. No service classes, no fetch helpers, no Clerk SDK imports. If a file in `shared-types` starts importing anything beyond `zod` and `@hono/zod-openapi`, it belongs in a feature or an app.

## How consumers use it

```ts
// apps/api — request validation + OpenAPI registration
import { itemDtoSchema, paginationResponseSchema, UserRole } from '@app/shared-types';

const listRoute = createRoute({
  method: 'get', path: '/',
  security: publicSecurity,
  request: { query: listItemsQuerySchema },
  responses: {
    200: { content: { 'application/json': { schema: paginationResponseSchema(itemDtoSchema, 'Item') } }, description: 'paginated list' },
  },
});
```

```ts
// apps/web — typed fetch wrappers
import type { PaginationResponse, ItemDto } from '@app/shared-types';

export async function listItems(token: string) {
  return apiClient.get<PaginationResponse<ItemDto>>('/items', {
    headers: { Authorization: `Bearer ${token}` },
  });
}
```

## Adding a new schema — the recipe

1. **Decide the file** — feature-specific → `src/features/<name>.ts`. Cross-feature → `src/cross-cutting/<name>.ts`.
2. **Write the schema + type in the same file**. Use `.openapi('PascalName')` for the component registry.
3. **Re-export from `src/index.ts`**:
   ```ts
   export { newDtoSchema, type NewDto } from './features/new-feature';
   ```
4. **Verify** with `pnpm typecheck`. Both apps should pick up the new export automatically.
5. **Reference in api routes** — the new schema shows up in `/openapi.json` and Scalar's components panel.
