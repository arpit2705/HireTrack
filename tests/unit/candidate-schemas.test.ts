import { describe, expect, it } from "vitest";
import {
  candidateCreateSchema,
  candidateUpdateSchema,
  parseCandidateListQuery,
} from "@/lib/schemas";

const valid = {
  name: "Ada Lovelace",
  email: "ada@example.com",
};

describe("candidateCreateSchema", () => {
  it("accepts a minimal candidate and defaults tags to []", () => {
    const parsed = candidateCreateSchema.parse(valid);
    expect(parsed.tags).toEqual([]);
  });

  it("requires a valid email (dedupe key)", () => {
    expect(
      candidateCreateSchema.safeParse({ ...valid, email: "nope" }).success,
    ).toBe(false);
  });

  it("REJECTS orgId and resumeUrl smuggling", () => {
    expect(
      candidateCreateSchema.safeParse({ ...valid, orgId: "org_2" }).success,
    ).toBe(false);
    expect(
      candidateCreateSchema.safeParse({
        ...valid,
        resumeUrl: "https://evil.example/x.pdf",
      }).success,
    ).toBe(false);
  });

  it("limits tags to 10 short entries", () => {
    expect(
      candidateCreateSchema.safeParse({
        ...valid,
        tags: Array.from({ length: 11 }, (_, i) => `t${i}`),
      }).success,
    ).toBe(false);
    expect(
      candidateCreateSchema.safeParse({ ...valid, tags: ["backend", "senior"] })
        .success,
    ).toBe(true);
  });
});

describe("candidateUpdateSchema", () => {
  it("accepts partial updates and rejects empty ones", () => {
    expect(candidateUpdateSchema.safeParse({ phone: "+1 555 0100" }).success).toBe(
      true,
    );
    expect(candidateUpdateSchema.safeParse({}).success).toBe(false);
  });

  it("REJECTS resumeUrl - the resume changes only via the upload endpoint", () => {
    expect(
      candidateUpdateSchema.safeParse({ resumeUrl: "x" }).success,
    ).toBe(false);
  });
});

describe("parseCandidateListQuery", () => {
  it("defaults and clamps", () => {
    expect(parseCandidateListQuery(new URLSearchParams())).toEqual({
      sort: "created_desc",
      limit: 20,
    });
    expect(
      parseCandidateListQuery(new URLSearchParams("limit=999")).limit,
    ).toBe(50);
  });

  it("parses q and tag", () => {
    const parsed = parseCandidateListQuery(
      new URLSearchParams("q=ada&tag=backend"),
    );
    expect(parsed.q).toBe("ada");
    expect(parsed.tag).toBe("backend");
  });
});
