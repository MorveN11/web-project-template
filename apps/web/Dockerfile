# syntax=docker/dockerfile:1.7
# Next.js standalone build. Three stages: deps → build → runner.
#
# Workspace hoisting (root devDependencies: typescript, tsx, vitest,
# @biomejs/biome, @types/node) means one install at `/app` covers
# every workspace package. Turbopack picks typescript up from the
# hoisted /app/node_modules during build.

ARG NODE_VERSION=lts-alpine

FROM node:${NODE_VERSION} AS base
WORKDIR /app
ENV CI=true \
    PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH
RUN corepack enable pnpm

# ---- deps --------------------------------------------------------------
FROM base AS deps
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
# Copy the shared-types SOURCE (not just package.json) so pnpm can
# symlink it into node_modules and Turbopack can resolve it during
# the next build. Filtered install keeps this stage slim.
COPY packages/shared-types ./packages/shared-types
COPY apps/web/package.json ./apps/web/package.json
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm fetch --frozen-lockfile && \
    pnpm install --filter @app/web... --offline --frozen-lockfile --ignore-scripts

# ---- build -------------------------------------------------------------
# Build ARGs bake the public runtime config into the JS bundle —
# NEXT_PUBLIC_* is inlined at build time, never read at runtime.
FROM base AS build
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_CLERK_SIGN_IN_URL=/auth/iniciar-sesion
ARG NEXT_PUBLIC_CLERK_SIGN_UP_URL=/auth/registro
ARG CLERK_SECRET_KEY

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY \
    NEXT_PUBLIC_CLERK_SIGN_IN_URL=$NEXT_PUBLIC_CLERK_SIGN_IN_URL \
    NEXT_PUBLIC_CLERK_SIGN_UP_URL=$NEXT_PUBLIC_CLERK_SIGN_UP_URL \
    CLERK_SECRET_KEY=$CLERK_SECRET_KEY

COPY --from=deps /app /app
COPY tsconfig.base.json ./tsconfig.base.json
COPY apps/web ./apps/web
WORKDIR /app/apps/web
RUN pnpm run build

# ---- runner ------------------------------------------------------------
# Standalone output: only `.next/standalone` + the static + public
# assets ship. Everything else (node_modules, source, .next cache) is
# dropped here.
FROM node:${NODE_VERSION} AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8080 \
    HOSTNAME=0.0.0.0
RUN addgroup -g 1001 -S web && adduser -S web -u 1001 -G web
COPY --from=build --chown=web:web /app/apps/web/.next/standalone ./
COPY --from=build --chown=web:web /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=web:web /app/apps/web/public ./apps/web/public
USER web
EXPOSE 8080
CMD ["node", "apps/web/server.js"]