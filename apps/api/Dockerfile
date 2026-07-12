# syntax=docker/dockerfile:1.7
# Hono api. Four stages: deps → build → prod-deps → runner.
#
# Workspace pnpm hoisting (root devDependencies: tsx, typescript,
# @types/node, vitest, @biomejs/biome) means one install at `/app` covers
# every package. The api only needs `tsx` + prod deps at runtime, so
# the `prod-deps` stage re-installs with `--prod` to drop ~90MB of
# dev tooling (TypeScript, Vitest, Biome, @types) before the runner
# stage copies anything to the final image.

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

# ---- prod-deps ---------------------------------------------------------
# Re-install prod-only deps into a clean tree. Drop devDeps
# (typescript, vitest, @biomejs/biome, @types/*) so the runner image
# only ships what the api needs at runtime + pnpm for the
# `migrate:deploy` entrypoint.
FROM base AS prod-deps
COPY --from=build /app /app
RUN pnpm install --filter @app/api... --offline --frozen-lockfile --prod --ignore-scripts && \
    pnpm store prune

# ---- runner ------------------------------------------------------------
# Targeted COPY: only the paths the api needs at runtime. Skips
# tsconfig, biome.json, pnpm-lock.yaml, biome config, and any source
# files from packages not consumed at runtime.
FROM node:${NODE_VERSION} AS runner
WORKDIR /app
ENV CI=true \
    NODE_ENV=production \
    PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    PORT=8080
RUN corepack enable pnpm
RUN addgroup -g 1001 -S nodejs && adduser -S api -u 1001 -G nodejs

COPY --from=prod-deps --chown=api:nodejs /app/apps/api /app/apps/api
COPY --from=prod-deps --chown=api:nodejs /app/packages /app/packages
COPY --from=prod-deps --chown=api:nodejs /app/pnpm-workspace.yaml /app/
COPY --from=prod-deps --chown=api:nodejs /app/node_modules /app/node_modules

USER api
WORKDIR /app/apps/api
EXPOSE 8080
ENTRYPOINT ["/app/apps/api/docker-entrypoint.sh"]
# Run via tsx (in /app/node_modules from the prod-deps stage via the
# root @types hoisted path) so source stays un-transpiled. `--import`
# (not the `tsx` CLI) keeps PATH stable for the entrypoint.
CMD ["node", "--import", "tsx", "src/index.ts"]