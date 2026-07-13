# syntax=docker/dockerfile:1.7
# Hono api. Three stages: deps → build → runner (slim, no pnpm).
#
# The previous slim design still bundled pnpm into the runner so the
# entrypoint could shell out to `pnpm exec prisma migrate deploy`. But
# pnpm + its store cost ~50MB and added a cold-start tax. Now the
# entrypoint runs the prisma CLI directly via `node` (it's shipped as
# plain JS in `prisma/build/index.js`), and the runtime install uses
# npm — which ships with the base image. The whole pnpm toolchain is
# build-stage-only.
#
# Other wins rolled in:
#   - esbuild bundles the api (1.1MB). node runs it directly, no tsx.
#   - workspace packages (@app/db, @app/shared-types) are transpiled to
#     JS in the build stage; their `exports` field maps `import` to
#     dist/ and `dev` to src/ so tsx in local dev still sees source.
#   - runner copies only the bundle, the prisma schema, the JS config,
#     and the entrypoint script. node_modules is built fresh from a
#     6-dep flat manifest (no workspace, no symlink fragility).
#   - prisma generate runs in the runner so the .prisma/client lands
#     next to the @prisma/client that the bundle resolves against.

ARG NODE_VERSION=24-alpine

# ---- base ----------------------------------------------------------------
FROM node:${NODE_VERSION} AS base
WORKDIR /app
ENV CI=true \
    PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH
RUN corepack enable pnpm

# ---- deps ----------------------------------------------------------------
FROM base AS deps
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY packages/db/package.json ./packages/db/package.json
COPY packages/shared-types/package.json ./packages/shared-types/package.json
COPY apps/api/package.json ./apps/api/package.json
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm fetch --frozen-lockfile && \
    pnpm install --filter @app/api... --offline --frozen-lockfile --ignore-scripts

# ---- build ---------------------------------------------------------------
# Build workspace packages to JS, then bundle the api.
FROM deps AS build
COPY tsconfig.base.json ./tsconfig.base.json
COPY packages/db ./packages/db
COPY packages/shared-types ./packages/shared-types
COPY apps/api ./apps/api
# Generate Prisma client first — produces the types @app/db imports.
RUN pnpm --filter @app/db generate
# Transpile workspace packages to JS so the api can be bundled without tsx.
RUN pnpm --filter @app/shared-types --filter @app/db build
RUN pnpm --filter @app/api build

# ---- runner --------------------------------------------------------------
# Slim image. No pnpm, no corepack, no shell tooling. node + npm only.
# npm runs the prod install; the entrypoint runs the prisma CLI directly.
FROM node:${NODE_VERSION} AS runner
WORKDIR /app
ENV CI=true \
    NODE_ENV=production \
    PORT=8080

# Non-root user with writable home.
RUN addgroup -g 1001 -S nodejs && adduser -S api -u 1001 -G nodejs \
    && mkdir -p /home/api/.cache/node/corepack /home/api/.local/share/pnpm \
    && chown -R api:nodejs /home/api

# Bundle + Prisma schema/config/migrations + entrypoint.
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/packages/db/prisma ./packages/db/prisma
COPY --from=build /app/packages/db/prisma.config.js ./packages/db/prisma.config.js
COPY apps/api/docker-entrypoint.sh /app/docker-entrypoint.sh
COPY apps/api/package.runtime.json ./package.json

# Fresh prod install (npm, no pnpm). --ignore-scripts keeps `postinstall`
# (prisma generate) from running here — we run it explicitly below so
# the .prisma/client lands next to the @prisma/client that the bundle
# resolves against.
RUN npm install --omit=dev --ignore-scripts --no-audit --no-fund \
    && node node_modules/prisma/build/index.js generate \
       --schema=./packages/db/prisma/schema.prisma \
       --config=./packages/db/prisma.config.js \
    && npm cache clean --force

RUN chown -R api:nodejs /app
USER api
WORKDIR /app/apps/api
EXPOSE 8080
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "--enable-source-maps", "dist/index.js"]
