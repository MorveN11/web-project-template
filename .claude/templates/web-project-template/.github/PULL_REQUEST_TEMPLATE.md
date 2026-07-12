# Pull Request

<!--
  Thanks for contributing to this project!

  - Provide a description of your changes below
  - Use a Conventional Commits title (e.g. feat(api): add item search)
  - Run through the checklist before requesting review
  - PR target branch per gitflow: open against `dev` (not `main`).
    Promotion to `test` happens on integration merge, to `main` on
    periodic release. See CONTRIBUTING.md § 2.
-->

## What

<!--- One short paragraph: what changed and why. -->

## Why

<!--- Link the issue / motivation. Closes #issue or Refs #issue. -->

## Type of change

<!-- Check exactly one. -->

- [ ] New feature (non-breaking)
- [ ] Bug fix (non-breaking)
- [ ] Breaking change (fix or feature that changes existing behavior)
- [ ] Refactor (no behavior change)
- [ ] Performance
- [ ] Documentation
- [ ] Tests only
- [ ] Build / CI / tooling
- [ ] Chore

## Breaking changes

<!--- If this is a breaking change, describe the impact and migration steps. Otherwise delete this section. -->

## How was it tested

<!--- Describe the tests you ran. For UI changes attach screenshots. -->

## Checklist

- [ ] Conventional commit title (`feat(scope): subject`)
- [ ] Conventional commit messages (CI enforces)
- [ ] `pnpm lint` clean
- [ ] `pnpm check` clean
- [ ] `pnpm typecheck` clean
- [ ] `pnpm test` passes
- [ ] `pnpm build` clean (api + web)
- [ ] New tests added for new logic (or documented why not)
- [ ] `.env.example` updated if new env vars were added
- [ ] DB migration added + tested (`pnpm db:migrate:dev`)
- [ ] Documentation updated (README / AGENTS / inline)

## Docs / config touched

<!-- Check all that apply. -->

- [ ] `README.md`
- [ ] `AGENTS.md`
- [ ] `CONTRIBUTING.md`
- [ ] `docs/architecture.md`
- [ ] `.github/workflows/`
- [ ] `docker-compose*.yml`
- [ ] `apps/api/Dockerfile`
- [ ] `apps/web/Dockerfile`
- [ ] `.dockerignore`
- [ ] `biome.json`
- [ ] `tsconfig.base.json`
- [ ] `pnpm-workspace.yaml`
- [ ] `package.json` (engines / hoisted deps)
- [ ] `.claude/skills/init-from-template/`

## Linked issue

Closes #

---

**For reviewers:** if you approve changes to CI/CD or releases, double-check that the workflows referenced in `.github/workflows/` actually exist and that required secrets are documented in `.github/SECRETS.md`.