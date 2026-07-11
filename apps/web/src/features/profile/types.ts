// Wire-shape types for the profile feature. `Profile` mirrors the
// `UserDto` returned by the api's `GET /users/me` — kept in sync
// manually for the template (in a larger project, codegen from the
// api's OpenAPI spec would replace this).

import type { UserRole } from '@app/shared-types';

export interface Profile {
  id: string;
  clerkId: string;
  email: string;
  firstName: string;
  lastName: string;
  imageUrl: string | null;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}