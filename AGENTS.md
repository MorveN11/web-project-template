# Agent guidance for this repo

## For AI assistants (Claude Code, etc.)

### Discovery first
- Use `codebase-memory-mcp` (or Grep/Glob fallback) to locate symbols before reading whole files.
- Trust the existing patterns. New code should match the layered structure already here.

### Where to put new code

| New… | Goes in |
| --- | --- |
| Prisma model | `packages/db/prisma/schema.prisma` — then `pnpm db:migrate:dev` |
| Backend feature | `apps/api/src/<feature>/{repository,service,routes,schemas,mappers,index}.ts`, mount in `src/index.ts` |
| Frontend feature | `apps/web/src/features/<feature>/{actions,schemas,types,constants}.ts` + `services/<feature>.service.ts` |
| Shared types (api ↔ web) | `packages/shared-types/src/` (zod schemas) or `import type ... from '@app/db'` |
| New env var | api: `apps/api/.env.example` + `apps/api/src/env.ts`. web: `apps/web/.env.example` + `apps/web/src/lib/env/{client,server}.ts`. root: `.env.example`. Test-env keys live in `.github/SECRETS.md` since the test channel deploys via Dokploy, not via a `.env` file on disk. |

### Backend layering
- **Route** → parses with zod, hands to service, maps `Result` via `handleResult`. No DB calls.
- **Service** → owns business rules + `Result<T>`. Calls the repository. No HTTP types.
- **Repository** → wraps `Database` from `@app/db`. Fluent Prisma facade, one class per feature. No business rules.

### Backend logging cheatsheet
- `LOG_LEVEL=debug` shows request lines + Prisma `error/warn` events.
- `LOG_QUERIES=true` enables Prisma `query` events (params + duration).
- Production: keep `LOG_LEVEL=info` (default). `LOG_QUERIES=false`.

### Frontend logging cheatsheet
- `import { logger } from '@/lib/logger'`. Logger is dev-only — production builds strip every call because `NODE_ENV` is inlined at build time and `isDev` lives in `lib/env/server`.
- For request payloads or anything sensitive, the dev-only logger is the right surface.

### VS Code workspace
- `.vscode/settings.json` configures Biome as default formatter + format-on-save + safe-fix-on-save (imports + quickfix only). No `formatOnPaste` accidental cascade.
- `.vscode/extensions.json` recommends the right extension set. Install on first open.

### Hard rules
- **Do not import `process.env` outside the env files.** api: `apps/api/src/env.ts`. web: `apps/web/src/lib/env/{client,server}.ts`. Logger reads `isDev` from `lib/env/server`.
- Do not import `@prisma/client` runtime into `apps/web`. Use `import type { ... } from '@app/db'`.
- Do not add new dependencies without justification in the PR. Stdlib / already-installed packages > new ones.
- Do not bypass `pnpm lint`. CI runs it on every PR.
- Do not commit secrets. Use `.env.example` with placeholder values.
- Conventional commits only — `feat`, `fix`, `chore`, `docs`, etc. CI rejects non-conforming titles/commits.
- The repo has **no root-level devDependencies** — tooling lives in per-package devDeps or via the `.vscode/` config. Keep it that way.

### Anti-patterns to avoid
- Per-feature service that talks to `database` directly. The repository facade isolates schema details from business rules.
- Fat services that embed business rules. Move decisions into the entity or a small domain helper.
- DB calls in routes. Routes only adapt HTTP → service call → `handleResult`.
- Client components for things that can be server components.
- `any` types. Prefer `unknown` + narrowing or proper Zod inference.
- A logger module that actually emits in production on the web.
- Adding hooks, lint-staged, commitlint, etc. as root deps. CI handles enforcement; VS Code handles local format/fix.
