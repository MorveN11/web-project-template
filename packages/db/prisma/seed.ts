// Idempotent seed. Run via `pnpm seed` from any workspace app or
/** biome-ignore-all lint/suspicious/noConsole: 'Logs for debugging seed process' */
// `pnpm --filter @app/db seed` from root. Currently a no-op smoke test.

import { database } from '../src/index.js';

async function main() {
  const userCount = await database.user.count();
  console.log(`[db:seed] users in db: ${userCount}`);
}

main()
  .catch((err) => {
    console.error('[db:seed] failed', err);
    process.exitCode = 1;
  })
  .finally(() => database.$disconnect());
