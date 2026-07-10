// User Prisma row → wire DTO. Shape lives here so the api can evolve
// storage independently of the wire contract.

import type { User } from '@app/db';
import type { UserRole } from '@app/shared-types';

export interface UserDto {
  id: string;
  clerkId: string;
  email: string;
  name: string | null;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export function toUserDto(row: User): UserDto {
  return {
    id: row.id,
    clerkId: row.clerkId,
    email: row.email,
    name: row.name,
    role: row.role as UserRole,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
