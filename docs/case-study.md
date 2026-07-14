# Case study: HireTrack

_Digital Heroes Full Stack Developer Trial — submitted with
[v1.0.0](https://github.com/devel-o-per/hiretrack/releases/tag/v1.0.0),
live at [hiretrack-dusky.vercel.app](https://hiretrack-dusky.vercel.app)._

## Problem

Small hiring teams outgrow spreadsheets long before they can justify an
enterprise ATS. They need the core loop — post a job, move candidates
through a pipeline, collect structured interview feedback, see where
things are stuck — with real multi-user access control (recruiters and
hiring managers see very different slices of the same data) and without a
sales call. The trial's constraints made this a security and correctness
problem as much as a CRUD one: server-side RBAC on every route, real
Postgres and real auth, WCAG AA, Lighthouse ≥ 90, and every async view
handling loading/empty/error/success.

## Approach

**Spec-first, then strict vertical slices.** The 16-milestone order from
plan.md was followed exactly, one reviewed slice at a time, with tests
written before business logic (the failing runs are part of the history)
and conventional, atomic commits throughout.

**Security as structure, not discipline.** Rather than trusting every
handler to remember checks, the invariants are load-bearing: an edge proxy
resolves the database session and applies the role matrix on every request
with default-deny for unregistered API routes; handler identity comes only
from proxy-stamped headers; query modules take `orgId` as their first
argument so the org boundary is unforgettable; input schemas are
`strictObject` so smuggling `orgId` is a 400. Sessions are database rows —
rotation and revocation are row operations, and a revoked cookie's next
request is a 401.

**Prove it by observed behavior.** Every security claim got a live
adversarial probe, recorded in an enforcement ledger in
[architecture.md](architecture.md): cross-org reads/mutations (404, no
existence leak), wrong-role access (explicit 403s, including the matrix's
deliberate "admins cannot submit scorecards" negative), replayed cookies
after password reset / role change / deactivation (401), an EXE renamed
`resume.pdf` (415 by magic bytes), a 10k-row CSV export timed past the
30-second gateway threshold (chunked, first byte at 1.9s), and two admins
concurrently demoting each other (exactly one succeeds — the guard
re-counts under a per-org advisory lock inside the transaction).

**Metrics as documented contracts.** Time-to-hire excluding reverted
pipeline time was specified in prose with a worked example *before*
implementation; unit tests reproduce the doc's tables verbatim, and a
seeded timeline with controlled timestamps read back 9.0/12.0 days from
the live API, exactly as the doc predicts.

## Result

A deployed, seeded, multi-org ATS: jobs, candidates with safe resume
handling, a drag-and-drop (and keyboard-operable) Kanban pipeline with
reject/unreject and audited concurrency, interview scheduling with
one-final-scorecard-per-interview, bulk actions with per-entity audit
rows, streamed CSV export, funnel/time-to-hire analytics, a per-candidate
timeline, and admin settings with real session revocation.

Numbers, all from real runs against production: Lighthouse landing
**99 / 100 / 96 / 100** and login **94 / 100 / 96 / 100**
(perf / a11y / best-practices / SEO — the 96 is a documented Lighthouse
artifact: its own injected scripts trip any restrictive CSP; the control
run without CSP scores 100). Zero console errors on a full incognito walk;
zero secret hits grepping all 27 shipped client chunks; axe reports zero
serious/critical issues across 13 screens; 139 unit tests plus a
Playwright e2e that deliberately routes through a stage revert and a
reject→unreject cycle before asserting board, audit trail, and analytics
state.

## What I learned

Specific things this project taught me, each earned by a real failure:

1. **Meta tags can be perfect while the unfurl is broken.** The OG image
   endpoint sat behind the auth proxy — every scraper would have received
   a login redirect while the `og:image` tag looked flawless. Only
   fetching the image *anonymously, as a scraper would* caught it. Lesson:
   validate the consumer's path, not the artifact.

2. **OKLCH lightness tweaks can do literally nothing.** A failing-contrast
   destructive color didn't budge across two "fixes" because the authored
   chroma was outside the sRGB gamut — Chrome's gamut mapping clamped
   every variant to nearly the same red. Design tokens must be verified as
   *rendered*, not as authored; the fix was reducing chroma into gamut,
   found only because axe measured the real pixels.

3. **A lockfile is written in a dialect.** npm 11 nested the wasm-variant
   `@emnapi` dependencies; npm 10 (bundled with Node 22 on CI) requires
   them hoisted and rejected the lock as out-of-sync. Local `npm install`
   "fixed" nothing because the local tree satisfied npm 11. The durable
   fix was regenerating the lock with npm 10 semantics — and learning that
   "works on my machine" now includes *which npm wrote your lockfile*.

4. **Optimistic UI plus navigation is a data-loss bug, not a test flake.**
   The e2e's final stage move asserted on the optimistic cache and
   navigated away — aborting the in-flight PATCH. The board said "Hired";
   the database said "interview". A user closing their laptop after
   dropping a card would hit exactly this. Fixed twice: the test awaits
   the server ACK, and the app sends board mutations with
   `fetch keepalive` (then probed: move → immediate navigation → row still
   committed).

Smaller ones that will stick: Auth.js refuses database sessions with a
credentials-only provider list (the workaround is documented in the auth
config); session cookie *names* depend on the request protocol, not
`NODE_ENV`, which silently broke local production; `@prisma/client`'s
postinstall runs during `npm ci` before `.env` can exist, so config must
not throw on a missing URL — caught only by running the README quick start
on a genuinely fresh clone; and a CSP experiment is worth running even
when the answer is "keep `unsafe-inline`", because now that answer carries
measurements (Turbopack's un-nonced preloads, Next's un-nonced streaming
scripts) instead of a shrug.
