// OpenAPI security scheme constants — referenced by every route's
// `security` field. Centralized so the public/admin distinction stays
// in lock-step across feature routers and the registered scheme name
// (`bearerAuth`) lives in exactly one place.
//
// Type is left unannotated on purpose — `createRoute`'s `security`
// field is a structural shape from `@hono/zod-openapi`, and typing
// these explicitly via the transitive `openapi3-ts/oas31` types
// would force this file to add a direct dep on that package.

// Public route — no auth required. The empty array in OpenAPI
// signals "this endpoint accepts anonymous requests".
export const publicSecurity: { bearerAuth: never[] }[] = [];

// Bearer-authenticated route — paired with the `bearerAuth` scheme
// registered at app boot in `src/index.ts`.
export const bearerSecurity = [{ bearerAuth: [] }];
