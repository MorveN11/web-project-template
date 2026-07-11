// Barrel for `@app/shared-types`. Source split into two layers:
//
//   cross-cutting/   concerns used by ≥ 2 features (error envelope,
//                    pagination, etc.)
//   features/       per-domain DTOs (item, user, ...)
//
// Each leaf file owns BOTH the zod schema and the inferred TS type
// for its concern, plus a top-of-file comment explaining the wire
// shape and which feature consumes it.
//
// External callers (`apps/api`, `apps/web`) keep importing from the
// package root (`@app/shared-types`) — this barrel re-exports
// everything so the public surface never changes.
//
// Public surface (stable):
//   apiErrorSchema, ApiErrorBody
//   itemDtoSchema, ItemDto
//   paginationResponseSchema(), PaginationResponse<T>
//   UserRole, userRoleSchema, UserRoleType

export { apiErrorSchema, type ApiErrorBody } from './cross-cutting/api-error';
export { paginationResponseSchema, type PaginationResponse } from './cross-cutting/pagination';

export { itemDtoSchema, type ItemDto } from './features/item';
export { UserRole, userRoleSchema, type UserRole as UserRoleType } from './features/user';