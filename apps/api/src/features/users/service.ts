// User service. `syncSelf` is the source of truth for Clerk ↔ local-DB
// reconciliation: it reads Clerk (from `auth.clerkUser`, fetched in
// the auth middleware), find-or-creates the local row, and stamps
// `privateMetadata.role` so the next request's auth lookup picks it
// up. Idempotent — safe to call on every request; the webhook handler
// is a best-case shortcut, not a requirement. Backend owns all Clerk
// BAPI writes; the web app never holds the service-role key.

import { UserRole } from '@app/shared-types';
import { createClerkClient } from '@clerk/backend';
import type { ClerkAuthContext } from '@/auth/clerk';
import { err, errConflict, errInternal, ok, type Result } from '@/core/result';
import { env } from '@/env';
import { logger } from '@/logger';
import { toUserDto, type UserDto } from './mappers';
import type { UserRepository } from './repository';
import type { CreateUserBody } from './schemas';

export class UserService {
  constructor(
    private readonly users: UserRepository,
    private readonly clerk = createClerkClient({ secretKey: env.CLERK_SECRET_KEY }),
  ) {}

  async getByClerkId(auth: ClerkAuthContext): Promise<Result<UserDto>> {
    return this.syncSelf(auth);
  }

  // Admin-only — provisions a Clerk account + stamps role + mirrors local row.
  async create(body: CreateUserBody): Promise<Result<UserDto>> {
    try {
      const existing = await this.users.findByEmail(body.email);
      if (existing) return err(errConflict(`user with email ${body.email} already exists`));

      const clerkUser = await this.clerk.users.createUser({
        emailAddress: [body.email],
        firstName: body.firstName,
        lastName: body.lastName,
        password: body.password,
      });

      const row = await this.users.create({
        clerkId: clerkUser.id,
        email: body.email,
        firstName: body.firstName,
        lastName: body.lastName,
        imageUrl: body.imageUrl ?? null,
        role: body.role,
      });

      await this.clerk.users.updateUserMetadata(clerkUser.id, {
        privateMetadata: { role: body.role },
      });

      return ok(toUserDto(row));
    } catch (cause) {
      logger.error({ cause, email: body.email }, 'user.create failed');
      const message = cause instanceof Error ? cause.message : 'unknown error';
      const conflict = /already/i.test(message);
      return err(conflict ? errConflict(message) : errInternal(cause));
    }
  }

  async syncSelf(auth: ClerkAuthContext): Promise<Result<UserDto>> {
    try {
      const existing = await this.users.findByClerkId(auth.clerkUserId);

      const email = auth.email;
      const firstName = auth.firstName;
      const lastName = auth.lastName;
      const imageUrl = auth.imageUrl;

      // Fast-path: row + Clerk metadata already match — no writes.
      if (
        existing &&
        existing.email === email &&
        existing.firstName === firstName &&
        existing.lastName === lastName &&
        (existing.imageUrl ?? null) === imageUrl &&
        existing.role === auth.role
      ) {
        return ok(toUserDto(existing));
      }

      // Role precedence: Clerk's privateMetadata (just stamped) > admin-assigned
      // local role > CLIENT default.
      const role = auth.role ?? (existing?.role as UserRole | undefined) ?? UserRole.CLIENT;

      const row = existing
        ? await this.users.upsert({ clerkId: auth.clerkUserId, email, firstName, lastName, imageUrl, role })
        : await this.users.create({ clerkId: auth.clerkUserId, email, firstName, lastName, imageUrl, role });

      const needsStamp = auth.role !== row.role;
      if (needsStamp) {
        await this.clerk.users.updateUserMetadata(auth.clerkUserId, {
          privateMetadata: { role: row.role },
        });
        logger.info({ clerkId: auth.clerkUserId, role: row.role }, 'syncSelf: stamped Clerk privateMetadata');
      }

      logger.info(
        { clerkId: auth.clerkUserId, outcome: existing ? 'updated' : 'created', stamped: needsStamp },
        'syncSelf',
      );
      return ok(toUserDto(row));
    } catch (cause) {
      logger.error({ cause, clerkId: auth.clerkUserId }, 'syncSelf failed');
      return err(errInternal(cause));
    }
  }
}

export { UserRole };
