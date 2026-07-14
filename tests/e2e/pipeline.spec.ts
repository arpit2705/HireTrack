import { expect, test, type Page } from "@playwright/test";

// Full pipeline e2e (plan.md section 8), deliberately NOT the pure happy
// path: create job -> add candidate -> advance to interview -> REVERT one
// stage -> advance again -> REJECT -> UNREJECT -> schedule interview ->
// submit scorecard -> advance to hired. Final assertions check state
// correctness (board columns, audit timeline, analytics numbers), not just
// the absence of errors.

const ADMIN = { email: "e2e-admin@example.com", password: "e2epassword1" };
const HM = { email: "e2e-hm@example.com", password: "e2epassword1" };
const CANDIDATE = { name: "E2E Candidate", email: "e2e-cand@example.com" };
const JOB_TITLE = "E2E Platform Role";
const ORG_SLUG = "e2e-org";

// Seed a clean org with a verified admin and hiring manager directly in the
// DB (signup's email-verification link lives only in server logs, so the
// e2e provisions users the same way the smoke probes did).
test.beforeAll(async () => {
  const { neon } = await import("@neondatabase/serverless");
  const { hash } = await import("@node-rs/argon2");
  const { config } = await import("dotenv");
  config({ quiet: true });

  const sql = neon(process.env.DATABASE_URL!);
  const passwordHash = await hash(ADMIN.password, {
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  // Tear down any previous run's org (FK-safe order), then recreate.
  await sql`DELETE FROM "scorecard" WHERE interview_id IN (
    SELECT i.id FROM "interview" i
    JOIN "application" a ON a.id = i.application_id
    JOIN "job" j ON j.id = a.job_id
    WHERE j.org_id IN (SELECT id FROM "organization" WHERE slug = ${ORG_SLUG}))`;
  await sql`DELETE FROM "interview" WHERE application_id IN (
    SELECT a.id FROM "application" a JOIN "job" j ON j.id = a.job_id
    WHERE j.org_id IN (SELECT id FROM "organization" WHERE slug = ${ORG_SLUG}))`;
  await sql`DELETE FROM "application" WHERE job_id IN (
    SELECT id FROM "job" WHERE org_id IN (SELECT id FROM "organization" WHERE slug = ${ORG_SLUG}))`;
  await sql`DELETE FROM "organization" WHERE slug = ${ORG_SLUG}`;
  await sql`DELETE FROM "rate_limit"`;

  await sql`INSERT INTO "organization" (id, name, slug, created_at)
    VALUES ('e2e_org', 'E2E Org', ${ORG_SLUG}, now())`;
  await sql`INSERT INTO "user" (id, org_id, email, password_hash, name, role, email_verified_at, created_at, updated_at)
    VALUES ('e2e_admin', 'e2e_org', ${ADMIN.email}, ${passwordHash}, 'E2E Admin', 'admin', now(), now(), now()),
           ('e2e_hm', 'e2e_org', ${HM.email}, ${passwordHash}, 'E2E HM', 'hiring_manager', now(), now(), now())`;
});

async function logIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL("**/");
}

function column(page: Page, name: string) {
  return page.locator(`section[aria-label^="${name} column"]`);
}

// Waits for the server ACK, not just the optimistic cache update - a
// navigation right after an optimistic assertion would abort the PATCH.
async function moveTo(page: Page, stage: string) {
  const serverAck = page.waitForResponse(
    (response) =>
      response.url().includes("/api/applications/") &&
      response.url().endsWith("/stage") &&
      response.request().method() === "PATCH" &&
      response.ok(),
  );
  await page
    .getByLabel(`Move ${CANDIDATE.name} to stage`)
    .selectOption(stage);
  await serverAck;
}

test("full pipeline with revert and reject/unreject cycle", async ({
  page,
  browser,
}) => {
  await logIn(page, ADMIN.email, ADMIN.password);

  // --- Create job ---
  await page.goto("/jobs/new");
  await page.getByLabel("Title").fill(JOB_TITLE);
  await page.getByLabel("Department").fill("Engineering");
  await page.getByLabel("Location").fill("Remote");
  await page.getByLabel("Initial status").selectOption("open");
  await page.getByRole("button", { name: "Create job" }).click();
  await page.waitForURL(/\/jobs\/(?!new)[a-z0-9]+$/);
  const jobUrl = page.url();
  await expect(page.getByRole("heading", { name: JOB_TITLE })).toBeVisible();

  // --- Add candidate ---
  await page.goto("/candidates/new");
  await page.getByLabel("Full name").fill(CANDIDATE.name);
  await page.getByLabel("Email").fill(CANDIDATE.email);
  await page.getByRole("button", { name: "Add candidate" }).click();
  await page.waitForURL(/\/candidates\/(?!new)[a-z0-9]+$/);
  const candidateUrl = page.url();

  // --- Put candidate on the board ---
  await page.goto(jobUrl);
  await page
    .getByLabel("Candidate", { exact: true })
    .selectOption({ label: `${CANDIDATE.name} (${CANDIDATE.email})` });
  await page.getByRole("button", { name: "Add to board" }).click();
  await expect(column(page, "Applied")).toContainText(CANDIDATE.name);

  // --- Advance to interview (forward jump) ---
  await moveTo(page, "interview");
  await expect(column(page, "Interview")).toContainText(CANDIDATE.name);

  // --- REVERT one stage: interview -> screening ---
  await moveTo(page, "screening");
  await expect(column(page, "Screening")).toContainText(CANDIDATE.name);
  await expect(column(page, "Interview")).not.toContainText(CANDIDATE.name);

  // --- Advance again ---
  await moveTo(page, "interview");
  await expect(column(page, "Interview")).toContainText(CANDIDATE.name);

  // --- REJECT (required reason, confirm step) ---
  await page.getByRole("button", { name: "Reject", exact: true }).click();
  await page
    .getByPlaceholder("Reason (required)", { exact: true })
    .fill("E2E test rejection");
  await page.getByRole("button", { name: "Confirm reject" }).click();
  await expect(column(page, "Interview")).not.toContainText(CANDIDATE.name);
  const drawer = page.locator("details", { hasText: "Rejected (1)" });
  await drawer.locator("summary").click();
  await expect(drawer).toContainText("rejected from Interview: E2E test rejection");

  // --- UNREJECT: board visibility restored at the stage rejected from ---
  await drawer.getByRole("button", { name: "Reinstate" }).click();
  await expect(column(page, "Interview")).toContainText(CANDIDATE.name);
  await expect(page.locator("details", { hasText: "Rejected (" })).toHaveCount(
    0,
  );

  // --- Schedule interview with the HM ---
  await page.goto("/interviews");
  // selectOption does not wait for async-loaded <option>s - wait explicitly.
  await expect(page.getByLabel("Job")).toContainText(JOB_TITLE);
  await page.getByLabel("Job").selectOption({ label: JOB_TITLE });
  await expect(page.getByLabel("Candidate", { exact: true })).toContainText(
    CANDIDATE.name,
  );
  await page
    .getByLabel("Candidate", { exact: true })
    .selectOption({ label: CANDIDATE.name });
  await expect(page.getByLabel("Interviewer")).toContainText("E2E HM");
  await page.getByLabel("Interviewer").selectOption({ label: "E2E HM" });
  await page.getByLabel("When").fill("2026-07-20T10:00");
  await page.getByLabel("Type").selectOption("technical");
  await page.getByRole("button", { name: "Schedule interview" }).click();
  await expect(page.getByText("Interview scheduled.")).toBeVisible();
  await expect(page.getByRole("row", { name: new RegExp(CANDIDATE.name) }))
    .toContainText("scheduled");

  // --- Submit scorecard as the HM (separate browser context) ---
  const hmContext = await browser.newContext();
  const hmPage = await hmContext.newPage();
  await logIn(hmPage, HM.email, HM.password);
  await hmPage.goto("/interviews");
  await hmPage.getByRole("link", { name: "Submit scorecard" }).click();
  await hmPage.waitForURL("**/scorecard");
  await hmPage
    .locator('label:has(input[name="rating"][value="4"])')
    .click();
  await hmPage.getByLabel("Recommendation").selectOption("yes");
  await hmPage
    .getByLabel("Notes")
    .fill("Strong e2e performance across the whole pipeline.");
  await hmPage.getByRole("button", { name: "Submit scorecard" }).click();
  await hmPage.waitForURL("**/interviews");
  await expect(
    hmPage.getByRole("row", { name: new RegExp(CANDIDATE.name) }),
  ).toContainText("4/5 · yes");
  await expect(
    hmPage.getByRole("row", { name: new RegExp(CANDIDATE.name) }),
  ).toContainText("completed");
  await hmContext.close();

  // --- Advance to hired ---
  await page.goto(jobUrl);
  await moveTo(page, "hired");
  await expect(column(page, "Hired")).toContainText(CANDIDATE.name);
  await expect(column(page, "Hired")).toContainText("1");

  // =============== FINAL STATE CORRECTNESS ===============

  // Audit timeline: every branch of the flow is recorded, in kind.
  await page.goto(candidateUrl);
  const timeline = page.getByLabel("Activity timeline");
  await expect(timeline).toContainText("Moved from applied to interview");
  await expect(timeline).toContainText(
    "Moved back from interview to screening", // stage_reverted
  );
  await expect(timeline).toContainText("Rejected — E2E test rejection");
  await expect(timeline).toContainText("Reinstated to interview"); // unrejected
  await expect(timeline).toContainText("Interview scheduled (technical)");
  await expect(timeline).toContainText("Scorecard submitted (4/5)");
  await expect(timeline).toContainText("Moved from interview to hired");

  // Analytics: the revert/unreject history must still yield a computable
  // time-to-hire (not the "—" placeholder) and exactly one hire.
  await page.goto("/analytics");
  const hires = page.getByText("Hires", { exact: true }).locator("..");
  await expect(hires).toContainText("1");
  // The VALUE element must show a computed number, not the "—" placeholder
  // (same-day pipeline -> 0.0d) - proving the revert/unreject history still
  // yields a computable time-to-hire.
  const tthValue = page
    .getByText("Avg time to hire")
    .locator("..")
    .locator(".text-3xl");
  await expect(tthValue).toHaveText("0.0d");
  await expect(page.getByText("Funnel conversion by stage")).toBeVisible();
});
