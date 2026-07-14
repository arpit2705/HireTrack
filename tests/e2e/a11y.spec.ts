import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Accessibility sweep (milestone 12): axe scan of every screen plus a
// KEYBOARD-ONLY Kanban stage move - drag-and-drop is the one inherently
// mouse-biased pattern in the app, so its accessible alternative (each
// card's "Move to..." menu) is verified end-to-end with keypresses only.

const ADMIN = { email: "a11y-admin@example.com", password: "a11ypassword1" };
const ORG_SLUG = "a11y-org";

async function sqlClient() {
  const { neon } = await import("@neondatabase/serverless");
  const { config } = await import("dotenv");
  config({ quiet: true });
  return neon(process.env.DATABASE_URL!);
}

test.beforeAll(async () => {
  const sql = await sqlClient();
  const { hash } = await import("@node-rs/argon2");
  const passwordHash = await hash(ADMIN.password, {
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  await sql`DELETE FROM "interview" WHERE application_id IN (
    SELECT a.id FROM "application" a JOIN "job" j ON j.id = a.job_id
    WHERE j.org_id IN (SELECT id FROM "organization" WHERE slug = ${ORG_SLUG}))`;
  await sql`DELETE FROM "application" WHERE job_id IN (
    SELECT id FROM "job" WHERE org_id IN (SELECT id FROM "organization" WHERE slug = ${ORG_SLUG}))`;
  await sql`DELETE FROM "organization" WHERE slug = ${ORG_SLUG}`;

  await sql`INSERT INTO "organization" (id, name, slug, created_at)
    VALUES ('a11y_org', 'A11y Org', ${ORG_SLUG}, now())`;
  await sql`INSERT INTO "user" (id, org_id, email, password_hash, name, role, email_verified_at, created_at, updated_at)
    VALUES ('a11y_admin', 'a11y_org', ${ADMIN.email}, ${passwordHash}, 'A11y Admin', 'admin', now(), now(), now()),
           ('a11y_hm', 'a11y_org', 'a11y-hm@example.com', ${passwordHash}, 'A11y HM', 'hiring_manager', now(), now(), now())`;
  await sql`INSERT INTO "job" (id, org_id, title, department, location, status, created_by, created_at, updated_at)
    VALUES ('a11y_job', 'a11y_org', 'A11y Role', 'Eng', 'Remote', 'open', 'a11y_admin', now(), now())`;
  await sql`INSERT INTO "candidate" (id, org_id, name, email, tags, source, created_at, updated_at)
    VALUES ('a11y_cand', 'a11y_org', 'Kay Board', 'kay@example.com', '{"backend"}', 'Referral', now(), now())`;
  await sql`INSERT INTO "application" (id, job_id, candidate_id, stage, stage_updated_at, created_at, updated_at)
    VALUES ('a11y_app', 'a11y_job', 'a11y_cand', 'applied', now(), now(), now())`;
});

async function logIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(ADMIN.email);
  await page.getByLabel("Password").fill(ADMIN.password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL("**/");
}

async function expectNoSeriousViolations(page: Page, name: string) {
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((violation) =>
    ["serious", "critical"].includes(violation.impact ?? ""),
  );
  expect(
    serious,
    `${name}: ${serious
      .map(
        (v) =>
          `${v.id} (${v.impact}) x${v.nodes.length} -> ${v.nodes[0]?.failureSummary?.slice(0, 300)}`,
      )
      .join(", ")}`,
  ).toEqual([]);
}

test("axe sweep: public pages", async ({ page }) => {
  for (const path of ["/", "/login", "/signup", "/forgot-password"]) {
    await page.goto(path);
    await expectNoSeriousViolations(page, path);
  }
});

test("axe sweep: authenticated screens", async ({ page }) => {
  await logIn(page);
  const screens = [
    "/jobs",
    "/jobs/new",
    "/jobs/a11y_job", // Kanban board
    "/candidates",
    "/candidates/new",
    "/candidates/a11y_cand", // detail + timeline
    "/interviews",
    "/analytics",
    "/settings",
  ];
  for (const path of screens) {
    await page.goto(path);
    // Let client boards/queries settle before scanning.
    await page.waitForLoadState("networkidle");
    await expectNoSeriousViolations(page, path);
  }
});

test("keyboard-only Kanban stage move via the Move-to menu", async ({
  page,
}) => {
  await logIn(page);
  await page.goto("/jobs/a11y_job");
  await expect(
    page.locator('section[aria-label^="Applied column"]'),
  ).toContainText("Kay Board");

  // Reach the card's move menu with TAB ONLY (no clicks, no focus() calls).
  const moveSelect = page.getByLabel("Move Kay Board to stage");
  let reached = false;
  for (let i = 0; i < 60; i++) {
    await page.keyboard.press("Tab");
    if (await moveSelect.evaluate((el) => el === document.activeElement)) {
      reached = true;
      break;
    }
  }
  expect(reached, "Move-to menu must be reachable by Tab alone").toBe(true);

  // Operate it with the keyboard: ArrowDown selects the first valid target
  // (screening) and fires the change event -> the move mutation.
  const serverAck = page.waitForResponse(
    (response) =>
      response.url().endsWith("/stage") &&
      response.request().method() === "PATCH" &&
      response.ok(),
  );
  await page.keyboard.press("ArrowDown");
  await serverAck;

  await expect(
    page.locator('section[aria-label^="Screening column"]'),
  ).toContainText("Kay Board");
  const sql = await sqlClient();
  const rows = await sql`SELECT stage FROM "application" WHERE id = 'a11y_app'`;
  expect(rows[0]?.stage).toBe("screening");
});
