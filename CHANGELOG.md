# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-07-13

First release: the complete applicant tracking system built for the Digital
Heroes Full Stack Developer Trial.

### Added

- **Auth & sessions** — email/password signup with verification gate,
  optional Google sign-in, Argon2id hashing, database-backed sessions with
  rotation on login and privilege change, rate-limited login/reset with
  exponential lockout, invite flow whose set-password link doubles as email
  verification.
- **Authorization** — full role permission matrix (admin / recruiter /
  hiring manager) enforced server-side in an edge proxy on every route with
  default-deny for unregistered API paths; row-level scoping (org boundary,
  hiring managers limited to candidates on their assigned interviews with
  explicit 403s); transactional last-admin guard under an advisory lock.
- **Jobs** — requisition CRUD with draft/open/closed lifecycle, search,
  filters, cursor pagination.
- **Candidates** — CRUD with org-level email dedupe, tags, sources, and
  resume upload validated by magic bytes (PDF/DOC/DOCX, 5 MB server-side)
  served exclusively through an authorized streaming endpoint.
- **Pipeline** — drag-and-drop Kanban board with optimistic updates and a
  keyboard-accessible move menu; forward moves and single-stage reverts
  logged distinctly (`stage_updated` / `stage_reverted`); rejection with
  required reason preserving the stage rejected from; reinstatement; soft
  delete with revival on re-application; last-write-wins concurrency with
  a complete audit trail.
- **Interviews & scorecards** — scheduling against active applications with
  same-org hiring-manager interviewers; one final scorecard per interview,
  assigned-interviewer-only.
- **Bulk actions & export** — bulk reject by selection or entire stage
  (server-side set), one audit row per candidate under a shared batch id;
  streamed CSV export (cursor batches, formula-injection-safe).
- **Analytics** — funnel conversion using preserved stage-at-rejection,
  candidate source breakdown, and time-to-hire excluding reverted time
  (documented methodology with worked examples pinned by unit tests).
- **Audit trail** — per-candidate activity timeline across applications and
  interviews; bulk rejections rendered distinctly with batch size.
- **Org settings** — rename, user invites, role changes and deactivation
  with immediate session revocation, org-wide sign-out.
- **Demo seed** — idempotent `npm run seed` builds a realistic org
  (demo@demo.com / demo1234) covering every product state, with backdated
  trails that produce non-trivial analytics.
- **Quality gates** — Vitest unit suite; Playwright full-pipeline e2e
  including a stage revert and reject→unreject cycle; axe accessibility
  sweep of every screen plus a keyboard-only board interaction test;
  Lighthouse ≥90 all categories on the production build (SEO 100); CI on
  every push.

### Security

- CSP (with a measured, documented `unsafe-inline` verdict and nonce
  plumbing in place), HSTS, nosniff, frame-ancestors, referrer and
  permissions policies; CSRF origin checks on all state-changing requests;
  secrets only in environment variables; storage locators for resumes never
  cross the API boundary.

[Unreleased]: https://github.com/devel-o-per/hiretrack/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/devel-o-per/hiretrack/releases/tag/v1.0.0
