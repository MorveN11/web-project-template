#!/bin/sh
# Production entrypoint. Applies pending Prisma migrations, optionally
# seeds, then execs the api. Idempotent: safe to run on every container
# start. The schema lives in ../../packages/db/prisma/schema.prisma;
# `pnpm db:migrate:deploy` is dispatched via the workspace filter.

set -e

cd /app

echo "[entrypoint] applying prisma migrations from packages/db"
pnpm --filter @app/db migrate:deploy

if [ "${SEED_ENABLED:-false}" = "true" ]; then
  echo "[entrypoint] seeding"
  pnpm --filter @app/db seed
fi

cd /app/apps/api
exec "$@"
