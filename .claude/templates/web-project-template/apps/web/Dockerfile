# syntax=docker/dockerfile:1.7
# Next.js standalone build. Three stages: deps → build → runner.

ARG NODE_VERSION=24-bookworm-slim

FROM node:${NODE_VERSION} AS base
WORKDIR /app
ENV CI=true \
    PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH
RUN corepack enable pnpm

# ---- deps --------------------------------------------------------------
# Manifests only before the install, so editing shared-types source doesn't
# invalidate it. `.npmrc` must be present so the node_modules layout matches
# local dev (public-hoist-pattern).
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY apps/web/package.json ./apps/web/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --filter @app/web... --frozen-lockfile --ignore-scripts

# Transpile shared-types to JS so Next.js resolves `./dist/index.js`
COPY tsconfig.base.json ./tsconfig.base.json
COPY packages/shared-types ./packages/shared-types
RUN pnpm --filter @app/shared-types... build

# ---- build -------------------------------------------------------------
# `FROM deps` inherits the stage. The previous `FROM base` + `COPY --from=deps
# /app /app` re-copied the entire Next/React/Clerk node_modules as one
# monolithic layer for no benefit.
FROM deps AS build
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_CLERK_SIGN_IN_URL
ARG NEXT_PUBLIC_CLERK_SIGN_UP_URL
ARG NEXT_PUBLIC_LOG_LEVEL

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY \
    NEXT_PUBLIC_CLERK_SIGN_IN_URL=$NEXT_PUBLIC_CLERK_SIGN_IN_URL \
    NEXT_PUBLIC_CLERK_SIGN_UP_URL=$NEXT_PUBLIC_CLERK_SIGN_UP_URL \
    NEXT_PUBLIC_LOG_LEVEL=$NEXT_PUBLIC_LOG_LEVEL \
    NEXT_TELEMETRY_DISABLED=1

COPY apps/web ./apps/web
WORKDIR /app/apps/web
RUN --mount=type=cache,id=next,target=/app/apps/web/.next/cache \
    pnpm run build

# ---- runner ------------------------------------------------------------
FROM gcr.io/distroless/nodejs24-debian12:nonroot AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8080 \
    HOSTNAME=0.0.0.0

COPY --from=build --chown=65532:65532 /app/apps/web/.next/standalone ./
COPY --from=build --chown=65532:65532 /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=65532:65532 /app/apps/web/public ./apps/web/public

EXPOSE 8080
USER nonroot

CMD ["apps/web/server.js"]
