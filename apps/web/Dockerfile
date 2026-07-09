# syntax=docker/dockerfile:1.7
# Next.js standalone build. Two stages: deps+build, runtime runs server.js.

ARG NODE_VERSION=20-alpine

FROM node:${NODE_VERSION} AS base
WORKDIR /app
ENV CI=true \
    PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH
RUN corepack enable && corepack prepare pnpm@10.33.2 --activate

FROM base AS deps
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY packages/db/package.json ./packages/db/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/shared-types/package.json ./packages/shared-types/package.json
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm fetch --frozen-lockfile=false && \
    pnpm install --filter @app/web... --offline --frozen-lockfile

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
COPY apps/web ./apps/web
WORKDIR /app/apps/web
RUN pnpm run build

FROM node:${NODE_VERSION} AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -g 1001 -S web && adduser -S web -u 1001 -G web
COPY --from=build --chown=web:web /app/apps/web/.next/standalone ./
COPY --from=build --chown=web:web /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=web:web /app/apps/web/public ./apps/web/public
USER web
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
