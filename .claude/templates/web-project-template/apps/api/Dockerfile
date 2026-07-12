# syntax=docker/dockerfile:1.7
# Hono api. Three stages: deps → build → runner.
#
# Workspace pnpm hoisting (root devDependencies: tsx, typescript,
# @types/node, vitest, @biomejs/biome) means one install at `/app` covers
# every package — no per-workspace install needed. The api itself only
# needs `tsx` at runtime, which lives at /app/node_modules/tsx after
# the deps stage.

ARG NODE_VERSION=lts-alpine

FROM node:${NODE_VERSION} AS base
WORKDIR /app
ENV CI=true \
    PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH
RUN corepack enable pnpm

# ---- deps --------------------------------------------------------------
# Copy only what pnpm needs to resolve the lockfile + package.jsons.
# Source is layered in the build stage to keep this cache tight.
FROM base AS deps
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY packages/db/package.json ./packages/db/package.json
COPY packages/shared-types/package.json ./packages/shared-types/package.json
COPY apps/api/package.json ./apps/api/package.json
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm fetch --frozen-lockfile && \
    pnpm install --filter @app/api... --offline --frozen-lockfile --ignore-scripts

# ---- build -------------------------------------------------------------
# Layer source on top, generate the Prisma client, compile the api.
FROM base AS build
ARG DATABASE_URL=postgresql://postgres:postgres@localhost:5440/web_project_template?schema=public
ENV DATABASE_URL=$DATABASE_URL

COPY --from=deps /app /app
COPY tsconfig.base.json ./tsconfig.base.json
COPY packages/db ./packages/db
COPY packages/shared-types ./packages/shared-types
COPY apps/api ./apps/api
RUN pnpm --filter @app/db generate
RUN pnpm --filter @app/api build

# ---- runner ------------------------------------------------------------
# Ship the whole workspace (workspace:* symlinks need real targets) +
# the entrypoint that applies pending migrations before exec'ing the api.
FROM node:${NODE_VERSION} AS runner
WORKDIR /app
ENV CI=true \
    NODE_ENV=production \
    PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    PORT=8080
# Pnpm stays available because the entrypoint runs
# `pnpm --filter @app/db migrate:deploy`. Slimming further would mean
# a raw `node node_modules/.bin/prisma migrate deploy` — defer until
# pnpm is a measurable chunk.
RUN corepack enable pnpm
RUN addgroup -g 1001 -S nodejs && adduser -S api -u 1001 -G nodejs

COPY --from=build --chown=api:nodejs /app /app
RUN chmod +x /app/apps/api/docker-entrypoint.sh

USER api
WORKDIR /app/apps/api
EXPOSE 8080
ENTRYPOINT ["/app/apps/api/docker-entrypoint.sh"]
# Run via tsx (hoisted to /app/node_modules) so source stays
# un-transpiled — Node's ESM resolver rejects tsc's extensionless
# relative imports. `--import` (not the `tsx` CLI) keeps PATH stable
# for the entrypoint.
CMD ["node", "--import", "tsx", "src/index.ts"]