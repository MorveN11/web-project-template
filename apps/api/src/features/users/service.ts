// User service. Two flows:
//   - `create()`   — admin-only: provisions a Clerk account + stamps
//                    role + mirrors local row.
//   - `syncSelf()` — self-service on sign-in: reads the Clerk user
//                    behind the JWT, mirrors to the local row, AND
//                    stamps `publicMetadata.{role,userId}` on Clerk
//                    so the next JWT carries the role + local id.
//                    Backend owns all Clerk BAPI writes — the web
//                    app never holds the service-role key.

import { UserRole } from '@app/shared-types';
import { createClerkClient } from '@clerk/backend';
import type { ClerkAuthContext } from '@/auth/clerk';
import { err, errConflict, errInternal, errNotFound, ok, type Result } from '@/core/result';
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

  // GET /me — read the local row for the caller. 404 if the row
  // hasn't been mirrored yet (call POST /me first).
  async getByClerkId(clerkId: string): Promise<Result<UserDto>> {
    const row = await this.users.findByClerkId(clerkId);
    if (!row) return err(errNotFound(`no local user row for clerkId ${clerkId}`));
    return ok(toUserDto(row));
  }

  // Admin-only — provisions a brand-new Clerk account + stamps the
  // requested role + mirrors the local row.
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
        name: [body.firstName, body.lastName].filter(Boolean).join(' ').trim() || null,
        role: body.role,
      });

      // Stamp role + local id on Clerk so the JWT carries both on
      // next sign-in. Backend-owned BAPI write — web never sees the
      // service-role key.
      await this.clerk.users.updateUserMetadata(clerkUser.id, {
        publicMetadata: { role: body.role, userId: row.id },
      });

      return ok(toUserDto(row));
    } catch (cause) {
      logger.error({ cause, email: body.email }, 'user.create failed');
      const message = cause instanceof Error ? cause.message : 'unknown error';
      const conflict = /already/i.test(message);
      return err(conflict ? errConflict(message) : errInternal(cause));
    }
  }

  // Self-service — called by the web's syncUserOnSignInAction on
  // every authenticated render. Single source of truth for the
  // Clerk↔local-DB sync. Sequence:
  //   1. Read Clerk user (name/email from Clerk, the canonical source).
  //   2. Find-or-create the local row (assigns `id`).
  //   3. Stamp `publicMetadata.{role,userId}` on Clerk so the next
  //      JWT carries both — id is the local row's cuid, role defaults
  //      to CLIENT. Idempotent: skip if metadata already matches.
  //
  // Idempotency at every step:
  //   - find-or-create → row exists after this point
  //   - metadata check → no-op BAPI write when (role, userId) matches
  async syncSelf(auth: ClerkAuthContext): Promise<Result<UserDto>> {
    try {
      const clerkUser = await this.clerk.users.getUser(auth.userId);
      const email = clerkUser.emailAddresses[0]?.emailAddress;
      if (!email) {
        logger.warn({ clerkId: auth.userId }, 'syncSelf: clerk user has no email');
        return err(errInternal(new Error('clerk user has no primary email')));
      }

      const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ').trim() || null;

      // Step 1 — find or create the local row. We need `row.id`
      // before we can stamp Clerk with the right `userId`.
      const existing = await this.users.findByClerkId(auth.userId);
      const row = existing
        ? await this.users.upsert({
            clerkId: auth.userId,
            email,
            name,
            role: existing.role as UserRole, // preserve — admin-only writes
          })
        : await this.users.create({
            clerkId: auth.userId,
            email,
            name,
            role: UserRole.CLIENT,
          });

      // Step 2 — stamp Clerk metadata with the local id + current role.
      // Read the current publicMetadata and only write when it differs
      // (avoids pointless BAPI traffic + audit-log noise on every render).
      const currentMeta = (clerkUser.publicMetadata ?? {}) as {
        role?: string;
        userId?: string;
      };
      const needsStamp = currentMeta.role !== row.role || currentMeta.userId !== row.id;

      if (needsStamp) {
        await this.clerk.users.updateUserMetadata(auth.userId, {
          publicMetadata: { role: row.role, userId: row.id },
        });
        logger.info({ clerkId: auth.userId, role: row.role, userId: row.id }, 'syncSelf: stamped Clerk publicMetadata');
      }

      logger.info({ clerkId: auth.userId, outcome: existing ? 'updated' : 'created', stamped: needsStamp }, 'syncSelf');
      return ok(toUserDto(row));
    } catch (cause) {
      logger.error({ cause, clerkId: auth.userId }, 'syncSelf failed');
      return err(errInternal(cause));
    }
  }
}

export { UserRole };
