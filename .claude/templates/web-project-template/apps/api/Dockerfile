# syntax=docker/dockerfile:1.7
# Hono api. Four stages: deps → build (toolchain) + runtime-deps → runner.
#
# The runner ships no pnpm and no corepack: the entrypoint invokes the
# prisma CLI directly via `node` (it's plain JS in `prisma/build/index.js`)
# and the production install uses npm, which ships with the base image.
# The whole pnpm toolchain is build-stage-only.
#
# `runtime-deps` exists so the production `npm install` + `prisma generate`
# cache on `package.runtime.json` + the schema alone. Folding them into the
# runner (after `COPY dist`) re-ran a ~150MB install on every source change.

ARG NODE_VERSION=24-bookworm-slim

# ---- base ----------------------------------------------------------------
FROM node:${NODE_VERSION} AS base
WORKDIR /app
ENV CI=true \
    PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH
RUN corepack enable pnpm

# ---- deps ----------------------------------------------------------------
# Filtered install: only @app/api and its workspace deps. `pnpm fetch` would
# download the whole lockfile (next, react, clerk/ui, tailwind, sharp…) to
# build a service that needs none of it. `.npmrc` must be present so the
# node_modules layout matches local dev (public-hoist-pattern).
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/db/package.json ./packages/db/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY apps/api/package.json ./apps/api/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --filter @app/api... --frozen-lockfile --ignore-scripts

# ---- build ---------------------------------------------------------------
# The api's `build` script already chains `prisma generate` +
# workspace package builds + the esbuild bundle. No manual steps here.
FROM deps AS build
COPY tsconfig.base.json ./tsconfig.base.json
COPY packages/db ./packages/db
COPY packages/shared-types ./packages/shared-types
COPY apps/api ./apps/api
RUN pnpm --filter @app/api build

# ---- runtime-deps --------------------------------------------------------
# Production node_modules, built in isolation so its cache key is
# `package.runtime.json` (install) and the prisma schema (generate) — never
# the application source. Install and generate are separate RUNs so a schema
# edit re-runs `generate` without re-running the install.
#
# `--ignore-scripts` keeps `postinstall` (prisma generate) from firing here;
# we run it explicitly below so `.prisma/client` lands next to the
# `@prisma/client` the bundle resolves against.
FROM node:${NODE_VERSION} AS runtime-deps
WORKDIR /app
COPY apps/api/package.runtime.json ./package.json
RUN --mount=type=cache,id=npm,target=/root/.npm \
    npm install --omit=dev --ignore-scripts --no-audit --no-fund
COPY packages/db/prisma/schema.prisma ./packages/db/prisma/schema.prisma
COPY packages/db/prisma.config.js ./packages/db/prisma.config.js
RUN node node_modules/prisma/build/index.js generate \
      --schema=./packages/db/prisma/schema.prisma \
      --config=./packages/db/prisma.config.js

# ---- runner --------------------------------------------------------------
# Slim image (Debian glibc). node + npm only.
#
# No `RUN chown -R /app`: on overlayfs that rewrites every file in the
# ~340MB prisma node_modules into a fresh layer, doubling the image and
# costing tens of seconds per build. Ownership is set by `COPY --chown`
# instead, which applies during a copy that happens anyway — free.
#
# node_modules DOES need to be writable by `api`: the prisma CLI runs a
# preflight writability check on `@prisma/engines` before every command,
# and the entrypoint shells out to it for `migrate deploy` + `db seed`.
# Everything else stays root-owned and read-only.
FROM node:${NODE_VERSION} AS runner
WORKDIR /app
ENV CI=true \
    NODE_ENV=production \
    PORT=8080

# OpenSSL: the `prisma-client-js` generator uses the binary query engine,
# which probes libssl/libcrypto at startup to pick its native binding.
# `node:24-bookworm-slim` ships the libs but Prisma's auto-detect doesn't
# always resolve the version; installing `openssl` makes it explicit.
# Combined with user creation to keep this a single, cache-stable layer.
RUN apt-get update -y && apt-get install -y --no-install-recommends \
        openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd -g 1001 nodejs \
    && useradd -u 1001 -g nodejs -m api

# Ordered least- to most-volatile so a source change only invalidates the
# last few (tiny) layers.
#
# Only what the entrypoint's `prisma migrate deploy` actually reads:
# schema + migrations. Copying the whole `prisma/` dir also dragged in
# `seed.ts`, which is dead weight in the image — the seed that runs is the
# esbuild bundle at `apps/api/dist/seed.js` (see prisma.config.js `seed`),
# and there's no tsx/ts-node here to execute the source anyway.
COPY --from=runtime-deps --chown=api:nodejs /app/node_modules ./node_modules
COPY --from=build /app/packages/db/prisma/schema.prisma ./packages/db/prisma/schema.prisma
COPY --from=build /app/packages/db/prisma/migrations ./packages/db/prisma/migrations
COPY --from=build /app/packages/db/prisma.config.js ./packages/db/prisma.config.js
COPY --chmod=755 apps/api/docker-entrypoint.sh /app/docker-entrypoint.sh
COPY apps/api/package.runtime.json ./package.json
COPY --from=build /app/apps/api/dist ./apps/api/dist

USER api
WORKDIR /app/apps/api
EXPOSE 8080
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "--enable-source-maps", "dist/index.js"]
