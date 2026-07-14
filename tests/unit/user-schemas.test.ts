import { describe, expect, it } from "vitest";
import {
  orgUpdateSchema,
  userInviteSchema,
  userRoleSchema,
} from "@/lib/schemas";

describe("userInviteSchema", () => {
  it("accepts a valid invite", () => {
    expect(
      userInviteSchema.safeParse({
        name: "New Recruiter",
        email: "new@example.com",
        role: "recruiter",
      }).success,
    ).toBe(true);
  });

  it("rejects invalid roles and orgId smuggling", () => {
    expect(
      userInviteSchema.safeParse({
        name: "X",
        email: "x@example.com",
        role: "superadmin",
      }).success,
    ).toBe(false);
    expect(
      userInviteSchema.safeParse({
        name: "X",
        email: "x@example.com",
        role: "recruiter",
        orgId: "other",
      }).success,
    ).toBe(false);
  });
});

describe("userRoleSchema", () => {
  it("accepts matrix roles only", () => {
    expect(userRoleSchema.safeParse({ role: "hiring_manager" }).success).toBe(
      true,
    );
    expect(userRoleSchema.safeParse({ role: "owner" }).success).toBe(false);
    expect(userRoleSchema.safeParse({}).success).toBe(false);
  });
});

describe("orgUpdateSchema", () => {
  it("requires a sane name and nothing else", () => {
    expect(orgUpdateSchema.safeParse({ name: "Acme Talent" }).success).toBe(
      true,
    );
    expect(orgUpdateSchema.safeParse({ name: "A" }).success).toBe(false);
    expect(
      orgUpdateSchema.safeParse({ name: "Acme", slug: "hijack" }).success,
    ).toBe(false);
  });
});
