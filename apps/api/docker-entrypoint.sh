#!/bin/sh
# Production entrypoint. Applies pending Prisma migrations, optionally
# seeds, then execs the api. Idempotent: safe to run on every container
# start. The slim runner has no pnpm — invoke the prisma CLI directly
# via node, schema + config live in /app/packages/db.

set -e

cd /app

echo "[entrypoint] applying prisma migrations from packages/db"
node node_modules/prisma/build/index.js migrate deploy \
  --schema=./packages/db/prisma/schema.prisma \
  --config=./packages/db/prisma.config.js

if [ "${SEED_ENABLED:-false}" = "true" ]; then
  echo "[entrypoint] seeding"
  node node_modules/prisma/build/index.js db seed \
    --schema=./packages/db/prisma/schema.prisma \
    --config=./packages/db/prisma.config.js
fi

cd /app/apps/api
exec "$@"
