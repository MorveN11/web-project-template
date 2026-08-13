#!/bin/sh
# Production entrypoint. Applies pending Prisma migrations, runs the
# boot-time seed (admin@template.test on empty DB, controlled by
# SEED_ENABLED), then execs the api. Idempotent: safe to run on
# every container start. The slim runner has no pnpm — invoke the
# prisma CLI directly via node, schema + config live in /app/packages/db.

set -e

cd /app

echo "[entrypoint] applying prisma migrations from packages/db"
node node_modules/prisma/build/index.js migrate deploy \
  --schema=./packages/db/prisma/schema.prisma \
  --config=./packages/db/prisma.config.js

echo "[entrypoint] running db seed (skips if SEED_ENABLED != true or users exist)"
node node_modules/prisma/build/index.js db seed \
  --schema=./packages/db/prisma/schema.prisma \
  --config=./packages/db/prisma.config.js

cd /app/apps/api
exec "$@"
