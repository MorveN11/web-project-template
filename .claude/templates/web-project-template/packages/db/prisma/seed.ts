// Boot-time DB seed. Runs at api container start after `prisma migrate deploy`.
// Toggle with `SEED_ENABLED` (default `true`). Idempotent — early-returns
// if any user already exists.
//
// What it seeds: a single placeholder `User` row with static clerkId.
// Lets every fresh deployment test `/users/me` against a known Clerk user.
// Delete this file + the `db seed` step in docker-entrypoint.sh if you
// don't need it.

/** biome-ignore-all lint/suspicious/noConsole: seed logs are debugging output by design */
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

  console.log('[seed] SEED_ENABLED is "true", running seed...');

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
