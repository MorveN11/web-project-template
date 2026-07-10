// Public auth types — the shape returned by `getCurrentSession` and
// any related helpers. Kept free of Clerk imports so non-server code
// can reference the type without dragging in the SDK.
//
// UserRole re-exported from @app/shared-types so the same enum flows
// api ↔ web ↔ prisma unchanged.

export { UserRole, type UserRole as UserRoleType } from '@app/shared-types';

export interface UserSession {
  id: string;
  clerkId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: import('@app/shared-types').UserRole;
}
