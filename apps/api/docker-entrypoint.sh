#!/bin/sh
# Production entrypoint. Applies pending Prisma migrations, then execs
# the api. Idempotent: safe to run on every container start. The slim
# runner has no pnpm — invoke the prisma CLI directly via node, schema
# + config live in /app/packages/db.
#
# Seed is intentionally NOT run here. The current seed is a smoke test
# (counts users); run it from the host with `pnpm db:seed` when needed.
# Bumping the seed to a runtime-bundled job costs ~10MB (tsx) and
# isn't worth it until seed becomes a real data fixture.

set -e

cd /app

echo "[entrypoint] applying prisma migrations from packages/db"
node node_modules/prisma/build/index.js migrate deploy \
  --schema=./packages/db/prisma/schema.prisma \
  --config=./packages/db/prisma.config.js

cd /app/apps/api
exec "$@"
