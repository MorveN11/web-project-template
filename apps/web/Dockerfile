# syntax=docker/dockerfile:1.7
# Next.js standalone build. Three stages: deps → build → runner.
#
# Workspace hoisting (root devDependencies: typescript, tsx, vitest,
# @biomejs/biome, @types/node) means one install at `/app` covers
# every workspace package. Turbopack picks typescript up from the
# hoisted /app/node_modules during build.
#
# The Next.js standalone output already does the heavy lifting —
# .next/standalone bundles only the api surface, server.js, and the
# node_modules actually imported by the app (no devDeps, no Tailwind
# config, no test framework). The runner stage just adds the static
# assets + public dir.

ARG NODE_VERSION=24-alpine

FROM node:${NODE_VERSION} AS base
WORKDIR /app
ENV CI=true \
    PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH
RUN corepack enable pnpm

# ---- deps --------------------------------------------------------------
FROM base AS deps
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY tsconfig.base.json ./tsconfig.base.json
# Copy the shared-types package files (incl. tsconfig.build.json +
# src/) so pnpm can symlink it and we can compile it to dist/ for the
# web build to resolve via the package's `exports` field.
COPY packages/shared-types ./packages/shared-types
COPY apps/web/package.json ./apps/web/package.json
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm fetch --frozen-lockfile && \
    pnpm install --filter @app/web... --offline --frozen-lockfile --ignore-scripts

# Transpile shared-types to JS so Next.js resolves `./dist/index.js`
# via the package's exports field (matches the api's setup). Drop the
# filter so tsc is reachable from /app/node_modules/.bin.
RUN pnpm --filter @app/shared-types... build

# ---- build -------------------------------------------------------------
# Build ARGs bake the public runtime config into the JS bundle —
# NEXT_PUBLIC_* is inlined at build time, never read at runtime.
FROM base AS build
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_CLERK_SIGN_IN_URL
ARG NEXT_PUBLIC_CLERK_SIGN_UP_URL

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY \
    NEXT_PUBLIC_CLERK_SIGN_IN_URL=$NEXT_PUBLIC_CLERK_SIGN_IN_URL \
    NEXT_PUBLIC_CLERK_SIGN_UP_URL=$NEXT_PUBLIC_CLERK_SIGN_UP_URL

COPY --from=deps /app /app
COPY tsconfig.base.json ./tsconfig.base.json
COPY apps/web ./apps/web
WORKDIR /app/apps/web
RUN pnpm run build

# ---- runner ------------------------------------------------------------
# Distroless Node base: ~200MB smaller than node:alpine, no shell
# tooling, no apk. Standalone Next.js bundle is self-contained; no
# package manager needed at runtime. The entrypoint must use the
# full path to node since distroless has no PATH for shims.
FROM gcr.io/distroless/nodejs24-debian12:nonroot AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8080 \
    HOSTNAME=0.0.0.0
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public
EXPOSE 8080
USER nonroot
# Distroless base sets ENTRYPOINT=/nodejs/bin/node already, so CMD is
# the script arg. WORKDIR is /app, so the relative path resolves.
CMD ["apps/web/server.js"]
