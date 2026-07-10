// `users` feature — admin-only user provisioning.
//
// File layout:
//   routes.ts       Admin-only Hono router (`requireRole(UserRole.ADMIN)`).
//                   Exports `userRoutes` + the wire `UserDto` shape.
//   schemas.ts      Zod schema for the create-user request body + the
//                   OpenAPI component registration.
//   service.ts      Clerk BAPI + local DB write sequence. Stamps
//                   `publicMetadata.role` so the JWT carries the role
//                   on next sign-in.
//   repository.ts   Local `User` table operations (lookup by
//                   clerkId/email, create).
//   mappers.ts      Prisma row → wire DTO.
//
// Public surface: `userRoutes` (mounted by `src/index.ts`).
export { userRoutes } from './routes';