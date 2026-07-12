# syntax=docker/dockerfile:1.7
# Hono api. Three stages: deps → build → runner.
#
# Workspace pnpm hoisting (root devDependencies: tsx, typescript,
# @types/node, vitest, @biomejs/biome) means one install at `/app`
# covers every package. We tried a `prod-deps` stage that re-installed
# with `--prod` to drop devDeps, but it broke pnpm's symlinks (the
# `prisma` bin in particular) and the apps/api postinstall couldn't
# find the CLI. Sticking with 3 stages costs ~90MB of devDeps in
# the final image; the size is a one-time download per build and
# the cached layer makes rebuilds cheap. Optimize later when pnpm
# deploy is stable on pnpm 11.x.
#
# The runner stage copies the full /app from build. tsconfig,
# biome.json, pnpm-lock.yaml and other build-only files come along
# but cost ~zero compared to the symlinked node_modules. Trying
# targeted COPYs (apps/api + packages + node_modules separately)
# broke pnpm's workspace symlinks — `tsx` and the @app/* workspace
# deps resolved from the wrong paths. Single COPY keeps the
# symlink graph intact.

ARG NODE_VERSION=24-alpine

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
FROM node:${NODE_VERSION} AS runner
WORKDIR /app
ENV CI=true \
    NODE_ENV=production \
    PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    PORT=8080
RUN corepack enable pnpm
RUN addgroup -g 1001 -S nodejs && adduser -S api -u 1001 -G nodejs \
    && mkdir -p /home/api/.cache/node/corepack /home/api/.local/share/pnpm \
    && chown -R api:nodejs /home/api

COPY --from=build --chown=api:nodejs /app /app

# WORKDIR creates /app as root. pnpm 11.12 writes config temp files in
# the cwd during `migrate:deploy` (and any other workspace command);
# `chown` the parent so the api user can write there.
RUN chown api:nodejs /app

USER api
WORKDIR /app/apps/api
EXPOSE 8080
ENTRYPOINT ["/app/apps/api/docker-entrypoint.sh"]
# Run via tsx (in /app/node_modules from the build stage) so source
# stays un-transpiled. `--import` (not the `tsx` CLI) keeps PATH
# stable for the entrypoint.
CMD ["node", "--import", "tsx", "src/index.ts"]