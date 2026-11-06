# Security Policy

## Reporting a Vulnerability

If you find a security vulnerability in this template (or in a fork before
you've changed enough to make it your own), please report it privately —
**do not open a public issue**.

Use GitHub's private vulnerability reporting:

1. Go to the repo's **Security** tab.
2. Click **Report a vulnerability**.
3. Describe the issue, affected files/endpoints, and steps to reproduce.

This opens a private advisory visible only to maintainers until a fix ships.

## Scope

This is a template, not a hosted service — most "vulnerabilities" here are
insecure defaults or patterns that would become real vulnerabilities once a
fork deploys them. Worth reporting:

- Auth/session handling in `apps/api/src/lib/auth/` or
  `apps/web/src/features/auth/`
- Rate-limiting bypasses in `apps/api/src/lib/http/rate-limit.ts`
- CSP / security-header gaps in `apps/web/next.config.ts`
- Secret handling in env parsing (`apps/api/src/env.ts`,
  `apps/web/src/lib/env/`) or CI workflows (`.github/workflows/`)
- Prisma query patterns that could enable injection or data leaks across
  tenants/users

Not in scope: vulnerabilities in third-party dependencies (report those
upstream) or issues that only exist in your own fork's custom code.

## Supported Versions

This template doesn't follow semver releases — `main` is the only
supported line. Pull the latest `main` to get a fix.
