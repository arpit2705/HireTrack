# Contributing to HireTrack

## Setup

Follow the [Quick start](README.md#quick-start). You'll want your own free
Neon (or any Postgres) database — the e2e suites and the seed script write
real data.

## Conventions this repo actually enforces

- **Conventional commits** (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`,
  `chore:`, with optional scope) — the history is atomic; don't squash
  unrelated changes together.
- **TypeScript strict, zero `any`.** `npm run typecheck` must pass.
- **Tests alongside business logic, not after.** Anything touching auth,
  RBAC, stage transitions, scorecards, or bulk actions gets a failing unit
  test first (see `tests/unit/`). One Playwright e2e covers the full
  pipeline; extend it rather than adding parallel flows.
- **Security invariants are structural** — read
  [docs/architecture.md](docs/architecture.md) before touching them:
  - Every new API route MUST be registered in `ROUTE_RULES`
    (`src/lib/auth/access.ts`); unmapped `/api` paths are denied by default.
  - Handler identity comes only from `requireUser()`; org scoping is baked
    into query modules (`orgId` as the first argument), never accepted from
    a request body (`z.strictObject` everywhere).
  - New pages needing role rules go in the enforcement ledger in
    docs/architecture.md, with a denial probe.
- **Every async view renders four states** — loading (skeleton matching the
  final layout), empty (with a CTA where one applies), error (named,
  actionable, with retry), success.
- **Design tokens**: 4px spacing scale, the type scale in globals.css, one
  indigo accent, radius family 6/8/12px, `motion-safe` transitions of
  150–250ms, 44px minimum tap targets, visible `focus-visible` on every
  control. Contrast changes must be re-verified against the RENDERED tokens
  (`tests/e2e/a11y.spec.ts` runs axe on every screen).

## Before opening a PR

```bash
npm run lint && npm run typecheck && npm run test && npm run test:e2e
```
