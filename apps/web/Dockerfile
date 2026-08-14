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
# GlitchTip / Sentry build-time only — used by `withSentryConfig` to
# upload source maps. Empty in dev builds without a token.
ARG SENTRY_AUTH_TOKEN
# GlitchTip browser SDK — inlined into the JS bundle at build time.
# Both testing + prod builds pass these (see release.test.yml +
# release.prod.yml); dev builds leave them empty.
ARG NEXT_PUBLIC_SENTRY_DSN
ARG NEXT_PUBLIC_SENTRY_ENVIRONMENT
ARG NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE
# Umami analytics — PRODUCTION ONLY. Test deploys deliberately omit
# these args; the <UmamiScript /> NODE_ENV gate + empty-value guard
# ensures no script renders on test. Empty in dev builds too.
ARG NEXT_PUBLIC_UMAMI_SCRIPT_URL
ARG NEXT_PUBLIC_UMAMI_WEBSITE_ID

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY \
    NEXT_PUBLIC_CLERK_SIGN_IN_URL=$NEXT_PUBLIC_CLERK_SIGN_IN_URL \
    NEXT_PUBLIC_CLERK_SIGN_UP_URL=$NEXT_PUBLIC_CLERK_SIGN_UP_URL \
    NEXT_PUBLIC_LOG_LEVEL=$NEXT_PUBLIC_LOG_LEVEL \
    SENTRY_AUTH_TOKEN=$SENTRY_AUTH_TOKEN \
    NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN \
    NEXT_PUBLIC_SENTRY_ENVIRONMENT=$NEXT_PUBLIC_SENTRY_ENVIRONMENT \
    NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=$NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE \
    NEXT_PUBLIC_UMAMI_SCRIPT_URL=$NEXT_PUBLIC_UMAMI_SCRIPT_URL \
    NEXT_PUBLIC_UMAMI_WEBSITE_ID=$NEXT_PUBLIC_UMAMI_WEBSITE_ID \
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
