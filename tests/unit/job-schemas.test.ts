import { describe, expect, it } from "vitest";
import {
  jobCreateSchema,
  jobUpdateSchema,
  parseJobListQuery,
} from "@/lib/schemas";

describe("jobCreateSchema", () => {
  const valid = {
    title: "Senior Backend Engineer",
    department: "Engineering",
    location: "Remote (EU)",
  };

  it("accepts a valid job and defaults status to draft", () => {
    const parsed = jobCreateSchema.parse(valid);
    expect(parsed.status).toBe("draft");
  });

  it("cannot create a job directly as closed", () => {
    expect(
      jobCreateSchema.safeParse({ ...valid, status: "closed" }).success,
    ).toBe(false);
  });

  it("REJECTS payloads carrying orgId - org scoping never comes from the client", () => {
    expect(
      jobCreateSchema.safeParse({ ...valid, orgId: "org_2" }).success,
    ).toBe(false);
  });

  it("trims whitespace and rejects empty title", () => {
    expect(jobCreateSchema.safeParse({ ...valid, title: "  " }).success).toBe(
      false,
    );
  });
});

describe("jobUpdateSchema", () => {
  it("accepts partial updates", () => {
    expect(jobUpdateSchema.safeParse({ title: "New title" }).success).toBe(
      true,
    );
  });

  it("rejects an empty update", () => {
    expect(jobUpdateSchema.safeParse({}).success).toBe(false);
  });

  it("REJECTS orgId and createdById overrides", () => {
    expect(jobUpdateSchema.safeParse({ orgId: "org_2" }).success).toBe(false);
    expect(jobUpdateSchema.safeParse({ createdById: "u9" }).success).toBe(
      false,
    );
  });
});

describe("parseJobListQuery", () => {
  it("applies defaults for an empty query", () => {
    const parsed = parseJobListQuery(new URLSearchParams());
    expect(parsed).toEqual({ sort: "created_desc", limit: 20 });
  });

  it("treats empty-string params as absent (URL-driven filters)", () => {
    const parsed = parseJobListQuery(
      new URLSearchParams("q=&status=&sort=&cursor="),
    );
    expect(parsed).toEqual({ sort: "created_desc", limit: 20 });
  });

  it("parses and clamps", () => {
    const parsed = parseJobListQuery(
      new URLSearchParams("q=backend&status=open&sort=title_asc&limit=500"),
    );
    expect(parsed.q).toBe("backend");
    expect(parsed.status).toBe("open");
    expect(parsed.sort).toBe("title_asc");
    expect(parsed.limit).toBe(50);
  });

  it("rejects unknown status values", () => {
    expect(() =>
      parseJobListQuery(new URLSearchParams("status=archived")),
    ).toThrow();
  });
});
