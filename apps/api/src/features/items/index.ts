// `items` feature — CRUD over the `Item` model.
//
// File layout:
//   routes.ts       Hono router(s) wired with auth + role middleware.
//                   Exports `itemRoutes` — public reads (list, getById)
//                   + admin writes (create, update, delete). Public and
//                   admin sides are separate OpenAPIHono instances
//                   mounted at the same path; Hono routes each request
//                   to the matching instance.
//   schemas.ts      Zod schemas for path/query/body + the wire DTO
//                   registration in OpenAPI's component registry
//                   (via `z.openapi('Name')`).
//   service.ts      Business rules + authz checks; returns Result<...>.
//   repository.ts   Prisma query shapes; one method per service need.
//   mappers.ts      Prisma row → wire DTO. The DTO type is re-exported
//                   from `@app/shared-types` so api + web share it.
//
// Public surface: `itemRoutes` (mounted by `src/index.ts`).
//
// Mounting: `app.route('/items', itemRoutes)` in `src/index.ts`. The
// router internally composes two sub-routers (public + admin) on the
// same path; Hono dispatches each request to the matching sub-router.
export { itemRoutes } from './routes';
