// Public types shared by the auth feature.
//
// Kept free of Clerk imports on purpose: a client component or a
// pure helper can import `UserSession` without pulling the Clerk SDK
// into its bundle. The only Clerk-adjacent concept exposed is the
// `clerkId` string, which the api hands back as a plain field.
//
// UserRole re-exports from @app/shared-types so api ↔ web ↔ prisma
// agree on the same enum without any web-side copy.

export { UserRole, type UserRole as UserRoleType } from '@app/shared-types';

/**
 * The local-DB representation of the signed-in user, returned by
 * `getCurrentSession()` and by `authService.getMyUserSession()`.
 *
 * Treat as read-only DTO. Dates arrive as ISO strings from the api.
 */
export interface UserSession {
  id: string;
  clerkId: string;
  firstName: string;
  lastName: string;
  email: string;
  imageUrl: string | null;
  role: import('@app/shared-types').UserRole;
  createdAt: string;
  updatedAt: string;
}
