// User repository. Fluent facade over Prisma — service holds business
// rules (authz, mapping, Result errors), repo holds query shapes.

import type { Database, User } from '@app/db';
import type { UserRole } from '@app/shared-types';

export interface CreateLocalUserInput {
  clerkId: string;
  email: string;
  firstName: string;
  lastName: string;
  imageUrl: string | null;
  role: UserRole;
}

export interface UpsertLocalUserInput {
  clerkId: string;
  email: string;
  firstName: string;
  lastName: string;
  imageUrl: string | null;
  role: UserRole;
  /** Set to mark the row soft-deleted; omit (or pass `undefined`) to clear. */
  deletedAt?: Date;
}

export class UserRepository {
  constructor(private readonly db: Database) {}

  findByClerkId(clerkId: string): Promise<User | null> {
    return this.db.user.findUnique({ where: { clerkId } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.db.user.findUnique({ where: { email } });
  }

  create(input: CreateLocalUserInput): Promise<User> {
    return this.db.user.create({
      data: {
        clerkId: input.clerkId,
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        imageUrl: input.imageUrl,
        role: input.role,
      },
    });
  }

  // Idempotent upsert keyed on `clerkId`. The webhook handler uses
  // this for both `user.updated` and `user.deleted` (soft-delete via
  // `deletedAt`). Play-by-play of the schema:
  //   - clerkId is unique → upsert picks the right row.
  //   - firstName / lastName are required (Clerk enforces at signup);
  //     webhook handlers fall back to the previous values if Clerk
  //     ever sends a malformed payload.
  //   - imageUrl is optional — omit to keep current, set to update.
  //   - deletedAt is optional → omit to clear, set to mark gone.
  upsert(input: UpsertLocalUserInput): Promise<User> {
    return this.db.user.upsert({
      where: { clerkId: input.clerkId },
      create: {
        clerkId: input.clerkId,
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        imageUrl: input.imageUrl,
        role: input.role,
      },
      update: {
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        imageUrl: input.imageUrl,
        role: input.role,
        ...(input.deletedAt !== undefined && { deletedAt: input.deletedAt }),
      },
    });
  }
}
