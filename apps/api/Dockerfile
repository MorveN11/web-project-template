# syntax=docker/dockerfile:1.7
# Hono api. Two stages: deps + build, then a runner that ships the
# prebuilt bundle + the Prisma schema needed by `migrate:deploy`.
#
# The Prisma schema lives at packages/db/prisma/schema.prisma. The api
# package depends on @app/db (workspace:*), so the generated
# @prisma/client runtime and engines land in node_modules transitively.

ARG NODE_VERSION=lts-alpine

FROM node:${NODE_VERSION} AS base
WORKDIR /app
ENV CI=true \
    PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH
RUN corepack enable pnpm

FROM base AS deps
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY packages/db/package.json ./packages/db/package.json
COPY apps/api/package.json ./apps/api/package.json
COPY packages/shared-types/package.json ./packages/shared-types/package.json
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm fetch --frozen-lockfile=false && \
    pnpm install --filter @app/api... --offline --frozen-lockfile --ignore-scripts

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

FROM node:${NODE_VERSION} AS runner
WORKDIR /app
ENV CI=true \
    NODE_ENV=production \
    PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    PORT=8080
# Enable corepack + the workspace's pinned pnpm so docker-entrypoint.sh
# can dispatch `pnpm --filter @app/db migrate:deploy`. Slimming this
# further would mean replacing the entrypoint's pnpm filter with a raw
# `node node_modules/.bin/prisma migrate deploy` — defer until pnpm is
# actually a measurable chunk.
RUN corepack enable pnpm
RUN addgroup -g 1001 -S nodejs && adduser -S api -u 1001 -G nodejs

# Bring the entire workspace so pnpm --filter inside the entrypoint
# resolves symlinks correctly.
COPY --from=build --chown=api:nodejs /app /app
RUN chmod +x /app/apps/api/docker-entrypoint.sh

USER api
WORKDIR /app/apps/api
EXPOSE 8080
ENTRYPOINT ["/app/apps/api/docker-entrypoint.sh"]
# Run the TypeScript source via tsx as a Node ESM loader. Compiled
# `dist/` is kept for local `node dist/index.js` runs and CI's
# `tsc -p tsconfig.build.json` check; the container skips the dist hop
# because Node's ESM resolver rejects extensionless relative imports
# emitted by tsc. `--import tsx` (not the `tsx` CLI) avoids touching
# PATH inside the entrypoint.
CMD ["node", "--import", "tsx", "src/index.ts"]
