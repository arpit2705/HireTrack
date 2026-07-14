# HireTrack

> HireTrack lets a small hiring team post jobs, move candidates through a visual pipeline, run structured interview scorecards, and see where every req is stuck — without the bloat of an enterprise ATS.

[![CI](https://github.com/devel-o-per/hiretrack/actions/workflows/ci.yml/badge.svg)](https://github.com/devel-o-per/hiretrack/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-4f46e5.svg)](LICENSE)

![HireTrack Kanban pipeline board](docs/screenshots/board.png)

**Live demo → [hiretrack-dusky.vercel.app](https://hiretrack-dusky.vercel.app)** — log in as `demo@demo.com` / `demo1234`

## Features

- **Post and manage job requisitions** — draft → open → closed lifecycle, with search, status filters, and cursor pagination
- **Drag candidates across a Kanban pipeline** (applied → screening → interview → offer → hired) with optimistic updates that snap back on failure, plus a fully keyboard-operable "Move to…" menu on every card
- **Reject with a required reason — and reinstate** — rejection preserves the stage it happened from, and the audit trail keeps both entries
- **Bulk-reject** a selection or an entire stage server-side (select-all-across-pages), gated behind a confirm step, logged one audit row per candidate
- **Upload resumes safely** — file type decided by magic bytes (PDF/DOC/DOCX allow-list, spoofed Content-Type ignored), 5 MB enforced server-side, served only through an org-scoped, role-checked endpoint
- **Schedule interviews and collect structured scorecards** — one final scorecard per interview, submittable only by the assigned hiring manager (admins deliberately cannot)
- **Track hiring analytics** — funnel conversion that counts rejections against the stage they died at, and time-to-hire that excludes reverted-stage time ([methodology](docs/architecture.md#time-to-hire-methodology-milestone-8))
- **Export any pipeline to CSV** — streamed in cursor batches, survives 10k+ rows past gateway timeouts, formula-injection-safe
- **Audit everything** — per-candidate activity timeline across applications and interviews, with bulk actions visibly distinct from one-off ones
- **Administer the org** — invite users (set-password email doubles as verification), change roles and deactivate users with immediate session revocation, org-wide sign-out

## Tech stack

Next.js 16 (App Router) · TypeScript strict · Tailwind CSS 4 + shadcn/ui · PostgreSQL (Neon) · Prisma 7 · Auth.js (database sessions) · Zod 4 · TanStack Query · dnd-kit · Recharts · Vitest · Playwright · GitHub Actions · Vercel

## Quick start

```bash
git clone <this-repo> hiretrack && cd hiretrack
npm ci
cp .env.example .env
# fill in DATABASE_URL (any Postgres; Neon free tier works) and AUTH_SECRET
npx prisma migrate deploy   # apply schema
npx prisma generate
npm run seed                # demo org + logins + realistic pipeline data
npm run dev                 # http://localhost:3000
```

Log in with a demo account (all passwords `demo1234`) — you land directly on a populated pipeline:

| Account | Role | Sees |
|---|---|---|
| `demo@demo.com` | Admin | Everything: org-wide analytics, settings, user management |
| `rachel@demo.com` | Recruiter | Jobs, candidates, boards, scheduling, analytics for her jobs |
| `marcus@demo.com` | Hiring manager | His assigned interviews + those candidates only, scorecard forms |
| `priya@demo.com` | Hiring manager | Her assigned interviews + those candidates only |

Switching between them is the fastest way to see the role matrix enforced (a hiring manager gets an explicit 403 on candidates outside their interviews, not an empty page).

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | ✅ | Postgres connection string (Neon: pooled string) |
| `AUTH_SECRET` | ✅ | Auth.js session/CSRF secret — `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `AUTH_TRUST_HOST` | ✅ (non-Vercel) | Tells Auth.js to trust the Host header |
| `APP_URL` | ✅ | Absolute base URL — emailed links, sitemap, OG metadata derive from it |
| `RESEND_API_KEY` | optional | Real email sending; without it, verification/reset links print to the server console |
| `EMAIL_FROM` | optional | From address for outgoing mail |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | optional | Google sign-in button appears only when both are set |
| `BLOB_READ_WRITE_TOKEN` | optional | Vercel Blob for resumes; without it, files go to a local `.uploads/` directory |

## Architecture

The full write-up lives in **[docs/architecture.md](docs/architecture.md)**: the data model and rejection-model design, the two-layer RBAC (route rules in an edge proxy + row-level checks in handlers, with a probe-backed enforcement ledger), database sessions with real rotation/revocation, the time-to-hire methodology with a worked example, resume storage that never exposes a file URL, and the measured CSP verdict.

## Testing

```bash
npm run test        # Vitest unit suite (schemas, RBAC matrix, rate limiter, stage machine, TTH…)
npm run test:e2e    # Playwright: full pipeline e2e (incl. revert + reject/unreject) + a11y sweep + keyboard-only board probe
npm run lint && npm run typecheck
```

The e2e suites boot the dev server themselves and need `DATABASE_URL`; they create and clean their own isolated orgs.

## Screenshots

| | |
|---|---|
| ![Jobs list](docs/screenshots/jobs.png) | ![Analytics](docs/screenshots/analytics.png) |
| ![Candidate timeline](docs/screenshots/candidate-timeline.png) | ![Interviews](docs/screenshots/interviews.png) |
| ![Settings](docs/screenshots/settings.png) | ![Pipeline board](docs/screenshots/board.png) |

## License

[MIT](LICENSE) — see also [CONTRIBUTING.md](CONTRIBUTING.md) and the [CHANGELOG](CHANGELOG.md).

---

Built as a submission for the **Digital Heroes Full Stack Developer Trial**.
