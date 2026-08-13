// Boot-time DB seed. Pure Prisma operations — no Clerk BAPI, no
// external API calls. Runs at api container start after `prisma
// migrate deploy`.
//
// Toggle: `SEED_ENABLED` env flag. Default `true` (every clone gets the
// seed on first boot). Set to `false` to disable.
//
// Idempotency: the seed early-returns if any user already exists in the
// database. Cheap `SELECT COUNT(*)` — fine until users > 10⁵.
//
// What this seeds:
//   A single placeholder `User` row with a static clerkId. This proves
//   the DB layer works at boot (insert succeeds, count guard behaves)
//   and gives every fresh deployment a row to test /users/me against
//   once a matching Clerk account is created.
//
// To make this user sign-in-able in Clerk:
//   1. Sign in to the Clerk dashboard.
//   2. Create a user with email `admin@template.test` and a Clerk
//      `user ID` of exactly `seed_admin_template` (or change the
//      `SEED_CLERK_ID` constant below to match the value Clerk
//      generated). The first user.created webhook will populate
//      `privateMetadata.role` from the local row's role column.
//   3. Or — easier — delete this file and the `db seed` step in
//      docker-entrypoint.sh if your fork doesn't need a seed user.

/** biome-ignore-all lint/suspicious/noConsole: 'Logs for debugging seed process' */
import { UserRole } from '@app/shared-types';
import { database } from '../src/index.js';

const SEED_CLERK_ID = 'seed_admin_template';
const SEED_EMAIL = 'admin@template.test';
const SEED_FIRST_NAME = 'Template';
const SEED_LAST_NAME = 'Admin';
const SEED_ROLE = UserRole.ADMIN;

async function main(): Promise<void> {
  if (process.env.SEED_ENABLED !== 'true') {
    console.log('[seed] SEED_ENABLED is not "true", skipping');
    return;
  }

  // Idempotency: skip when the DB already has users.
  const existing = await database.user.count();
  if (existing > 0) {
    console.log(`[seed] ${existing} users already present, skipping`);
    return;
  }

  // Pure DB insert. clerkId is a known sentinel — match it when
  // creating the matching Clerk account in the dashboard.
  const row = await database.user.create({
    data: {
      clerkId: SEED_CLERK_ID,
      email: SEED_EMAIL,
      firstName: SEED_FIRST_NAME,
      lastName: SEED_LAST_NAME,
      imageUrl: null,
      role: SEED_ROLE,
    },
  });

  console.log(`[seed] created user ${row.id} (clerkId=${row.clerkId}, role=${row.role})`);
  console.log(
    `[seed] to sign in as this user, create a Clerk account with id "${SEED_CLERK_ID}" and email ${SEED_EMAIL}`,
  );
}

main()
  .catch((err) => {
    console.error('[seed] failed:', err);
    process.exitCode = 1;
  })
  .finally(() => database.$disconnect());
