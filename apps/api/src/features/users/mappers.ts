// User Prisma row → wire DTO. Shape lives here so the api can evolve
// storage independently of the wire contract.
//
// `firstName` / `lastName` are separate fields (Clerk's wire shape
// matches — never combine them into a single `name`). `imageUrl` is
// optional — Clerk sends it on every user.updated webhook when the
// user changes their avatar.

import type { User } from '@app/db';
import type { UserRole } from '@app/shared-types';

export interface UserDto {
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

export function toUserDto(row: User): UserDto {
  return {
    id: row.id,
    clerkId: row.clerkId,
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    imageUrl: row.imageUrl,
    role: row.role as UserRole,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}