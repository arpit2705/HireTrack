# plan.md — HireTrack

> Applicant Tracking System (ATS) — pipeline management, interview scorecards,
> and hiring analytics for recruiters and hiring managers.
>
> Built for the Digital Heroes Full Stack Developer Trial.

---

## 1. One-Sentence Pitch

HireTrack lets a small hiring team post jobs, move candidates through a visual
pipeline, run structured interview scorecards, and see where every req is
stuck — without the bloat of an enterprise ATS.

---

## 2. User Stories

### Admin (org owner)
- As an Admin, I can create the organization and invite Recruiters/Hiring Managers.
- As an Admin, I can see org-wide hiring metrics across all jobs.
- As an Admin, I can manage roles and deactivate users.

### Recruiter
- As a Recruiter, I can create/edit/close a job requisition.
- As a Recruiter, I can add a candidate manually or via resume upload.
- As a Recruiter, I can drag a candidate across pipeline stages on a Kanban board.
- As a Recruiter, I can schedule an interview and assign a Hiring Manager.
- As a Recruiter, I can bulk-reject candidates from a stage.
- As a Recruiter, I can export a job's candidate pipeline to CSV.
- As a Recruiter, I can search/filter candidates by job, stage, tag, or score.

### Hiring Manager
- As a Hiring Manager, I can view candidates assigned to my interviews.
- As a Hiring Manager, I can submit a structured scorecard (rating + notes) after an interview.
- As a Hiring Manager, I cannot see candidates for jobs I'm not assigned to (row-level auth).

### Anonymous / Demo Reviewer
- As a reviewer, I can log in with a read-only demo account and see realistic seeded data immediately.

---

## 3. Data Model

### Entities

```
Organization
  id, name, slug, created_at

User
  id, org_id, email, password_hash, name, role [admin|recruiter|hiring_manager],
  email_verified_at, created_at, updated_at

Job
  id, org_id, title, department, location, status [draft|open|closed],
  created_by (User), created_at, updated_at, closed_at

Candidate
  id, org_id, name, email, phone, resume_url, source, tags[], created_at

Application            (join of Candidate <-> Job, with pipeline state)
  id, job_id, candidate_id, stage [applied|screening|interview|offer|hired|rejected],
  stage_updated_at, rejected_reason, created_at, updated_at, deleted_at

Interview
  id, application_id, scheduled_at, interviewer_id (User), type [phone|technical|onsite],
  status [scheduled|completed|cancelled], created_at

Scorecard
  id, interview_id, submitted_by (User), rating (1-5), recommendation [strong_yes|yes|no|strong_no],
  notes, created_at

ActivityLog             (audit trail)
  id, org_id, actor_id (User), entity_type, entity_id, action, metadata (json), created_at
```

### Relationships
- Organization 1—N User, Job, Candidate
- Job 1—N Application
- Candidate 1—N Application
- Application 1—N Interview
- Interview 1—1 Scorecard (one scorecard per interview, per interviewer)
- Every mutating action → 1 ActivityLog row

### Indexes (non-obvious ones worth calling out)
- `application(job_id, stage)` — Kanban board query
- `candidate(org_id, email)` unique — dedupe on re-application
- Full-text/trigram index on `candidate.name`, `candidate.email` — search
- `activity_log(org_id, entity_type, entity_id)` — per-entity audit queries

### Nullable fields that should actually be required (flag these explicitly to Claude Code)
- `application.rejected_reason` — required once stage = rejected, nullable otherwise (conditional constraint, enforce in app layer + check constraint)
- `interview.interviewer_id` — required, never null (a scheduled interview with no interviewer is a bug)

---

## 4. Pipeline State Machine

```
Applied → Screening → Interview → Offer → Hired
                                        ↘ Rejected (from any stage)
```
- Rejection is a terminal stage reachable from any prior stage, with a required `rejected_reason`.
- Stage changes are logged to `ActivityLog` with old_stage → new_stage.
- Only Recruiter/Admin can move stages. Hiring Manager can only submit scorecards.

---

## 5. Role Permission Matrix

| Action | Admin | Recruiter | Hiring Manager |
|---|---|---|---|
| Create/edit job | ✅ | ✅ (own org) | ❌ |
| View all candidates in org | ✅ | ✅ | ❌ (assigned interviews only) |
| Move pipeline stage | ✅ | ✅ | ❌ |
| Schedule interview | ✅ | ✅ | ❌ |
| Submit scorecard | ❌ | ❌ | ✅ (own interviews only) |
| Bulk actions / CSV export | ✅ | ✅ | ❌ |
| Manage users/roles | ✅ | ❌ | ❌ |
| View org-wide analytics | ✅ | ✅ (own jobs) | ❌ |

**Enforce every row of this table server-side in middleware — never trust a role claim from the client.**

---

## 6. Screens (with required states)

Every screen below must explicitly handle: **loading, empty, error, success.**

1. **Login / Signup** — email+password, OAuth optional, email verification gate
2. **Org dashboard** (Admin) — headcount, open reqs, org-wide funnel chart
3. **Jobs list** — table, filter by status, create job CTA
4. **Job detail → Kanban board** — drag-and-drop across stages, candidate cards
5. **Candidate detail** — timeline, resume, notes, scorecards, stage history
6. **Add/import candidate** — manual form + resume upload
7. **Interview scheduling** — pick candidate, interviewer, time, type
8. **Scorecard form** (Hiring Manager) — rating, recommendation, notes
9. **Analytics** — time-to-hire, funnel conversion by stage, source breakdown
10. **Settings** — org info, user management (Admin), danger zone
11. **404 page**, **error boundary fallback**

---

## 7. API Surface (server actions / REST — pick one, be consistent)

| Action | Method | Auth |
|---|---|---|
| `POST /api/auth/signup` | POST | public |
| `POST /api/auth/login` | POST | public, rate-limited |
| `POST /api/auth/reset` | POST | public, rate-limited |
| `GET /api/jobs` | GET | recruiter+ |
| `POST /api/jobs` | POST | recruiter+ |
| `GET /api/jobs/:id/applications` | GET | recruiter+, row-scoped |
| `PATCH /api/applications/:id/stage` | PATCH | recruiter+ |
| `POST /api/applications/bulk-reject` | POST | recruiter+ |
| `GET /api/applications/export` | GET | recruiter+, streamed CSV |
| `POST /api/interviews` | POST | recruiter+ |
| `POST /api/interviews/:id/scorecard` | POST | assigned hiring_manager only |
| `GET /api/analytics/funnel` | GET | recruiter+, org/job scoped |

Every mutation returns the updated record. Every list endpoint supports
`?q=&stage=&sort=&cursor=&limit=` and mirrors filters into the URL.

---

## 8. Tech Stack (locked)

- **Framework**: Next.js 14+ (App Router), TypeScript strict mode
- **UI**: React + Tailwind CSS + shadcn/ui
- **DB**: PostgreSQL (Neon or Supabase free tier)
- **ORM**: Prisma
- **Auth**: Auth.js (NextAuth) — credentials provider + Google OAuth
- **Validation**: Zod (shared client/server schemas)
- **State/data**: TanStack Query + server actions
- **Testing**: Vitest (unit) + Playwright (one e2e: full pipeline flow)
- **CI**: GitHub Actions — lint, typecheck, test on every push
- **Hosting**: Vercel + Neon Postgres
- **Drag-and-drop**: `@dnd-kit/core` for the Kanban board

---

## 9. Milestone Build Order (one vertical slice per Claude Code session)

1. Repo scaffold + CI + `.env.example` + Prisma schema + migration (no features yet)
2. Auth: signup, login, email verification, session cookies, RBAC middleware
3. Jobs CRUD (Recruiter/Admin) + job list with search/filter
4. Candidates CRUD + resume upload (allow-listed MIME/size)
5. Applications + Kanban board (drag-and-drop stage changes, optimistic UI)
6. Interviews scheduling + Scorecard submission (Hiring Manager scoped)
7. Bulk actions + CSV export (streamed)
8. Analytics dashboard (funnel, time-to-hire charts)
9. Activity log / audit trail
10. All empty/loading/error states pass audit + 404 + error boundary
11. SEO: meta tags, OG image, sitemap, robots.txt, JSON-LD
12. Accessibility + Lighthouse pass (≥90 all categories)
13. Seed script (demo org + demo login + realistic fake data)
14. README, docs/architecture.md, CONTRIBUTING, CHANGELOG, LICENSE
15. Deploy to Vercel, verify prod auth + no console errors + no leaked secrets
16. Demo video + case study + tag v1.0.0

**Rule: do not start a milestone until the previous one's diff has been read and approved.**

---

## 10. Edge Cases to Handle Explicitly

- Two recruiters move the same candidate's stage simultaneously (last-write-wins is fine, but log both).
- Candidate applies to the same job twice (dedupe by org+email+job, don't create duplicate Application).
- Hiring Manager tries to view a candidate outside their assigned interviews → 403, not a silent empty list.
- Resume upload exceeds size limit or wrong MIME type → clear client-side + server-side rejection.
- CSV export requested for 10k+ rows → must stream, not block past the ~30s gateway timeout.
- Rejecting a candidate without a reason → blocked client-side and server-side.
- Session expires mid-drag-and-drop on the Kanban board → mutation fails gracefully, card snaps back, toast shown.

---

## 11. Non-Negotiable Constraints (from the trial doc — do not skip)

- TypeScript strict, zero `any`
- Real Postgres DB, real auth — no localStorage-as-database
- Passwords hashed (Argon2id or bcrypt cost ≥12), never logged or emailed in plaintext
- Server-side RBAC enforced in middleware on every route
- Rate limiting on login/reset (~5 attempts/15min/IP+account)
- Shared Zod validation client + server
- Soft deletes (`deleted_at`) where recovery matters (Applications)
- Secrets only in env vars — grep the client bundle before submission to confirm none leaked
- CSP, HSTS, X-Content-Type-Options headers + CSRF protection
- WCAG 2.1 AA: semantic HTML, focus traps, ARIA labels, 4.5:1 contrast, full keyboard operability
- Every async view: loading / empty / error / success — no blank flash
- Demo login (`demo@demo.com` / `demo1234`) with seeded realistic data
- Public repo, MIT LICENSE, CONTRIBUTING.md, CHANGELOG.md (Keep a Changelog format), tagged `v1.0.0`
- Conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`)
- Lighthouse ≥90 on Performance, Accessibility, Best Practices, SEO
- Live deployed URL, verified in incognito, zero console errors

---

## 12. Open Questions (resolve before coding, per the trial's "spec-first" workflow)

- Single-tenant vs multi-org from day one? → **Decision: multi-org from the start**, since Organization is already in the schema — cheaper now than retrofitting.
- Resume storage: Vercel Blob, Supabase Storage, or S3-compatible? → pick based on whichever pairs with the chosen DB host to avoid a second cloud account.
- Real email sending (verification, reset) — Resend or Postmark free tier? → needed for the "email verification before write access" requirement to be real, not stubbed.