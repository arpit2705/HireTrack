import { headers } from "next/headers";
import { roleSchema, type Role } from "@/lib/schemas";

export interface RequestUser {
  userId: string;
  orgId: string;
  role: Role;
}

// Identity comes ONLY from the x-user-* headers stamped by src/proxy.ts
// after the database session lookup (any inbound copies are stripped there
// first). orgId is a SECURITY BOUNDARY: handlers must scope every query with
// requireUser().orgId and never accept an org, role, or user id from a
// request body, query string, or client-supplied header.
export async function requireUser(): Promise<RequestUser> {
  const requestHeaders = await headers();
  const userId = requestHeaders.get("x-user-id");
  const orgId = requestHeaders.get("x-org-id");
  const role = roleSchema.safeParse(requestHeaders.get("x-user-role"));

  if (!userId || !orgId || !role.success) {
    // The proxy rejects unauthenticated requests before handlers run, so
    // reaching this means a route escaped the proxy matcher - fail loudly.
    throw new Error(
      "requireUser: no proxy identity on request - is the route covered by src/proxy.ts?",
    );
  }
  return { userId, orgId, role: role.data };
}
