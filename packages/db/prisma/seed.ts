// Idempotent seed. Run via `pnpm seed` from any workspace app or
// `pnpm --filter @app/db seed` from root. Currently a no-op smoke test.

import { database } from '../src/index.js';

async function main() {
  const userCount = await database.user.count();
  // biome-ignore lint/suspicious/noConsole: one-off CLI script, logger is overkill here
  console.log(`[db:seed] users in db: ${userCount}`);
}

main()
  .catch((err) => {
    // biome-ignore lint/suspicious/noConsole: one-off CLI script
    console.error('[db:seed] failed', err);
    process.exitCode = 1;
  })
  .finally(() => database.$disconnect());