import type { Role } from "@/lib/schemas";

// Role permission matrix (plan.md section 5). This is the single source of
// truth consulted by the RBAC middleware and by row-level handler checks.
// Note the deliberate negative: admins/recruiters cannot submit scorecards -
// scorecards come only from the assigned interviewer (hiring manager).
export const PERMISSIONS = {
  "job:manage": ["admin", "recruiter"],
  "job:view": ["admin", "recruiter"],
  "candidate:view_all": ["admin", "recruiter"],
  // Single-candidate reads: hiring managers pass the proxy, then the handler
  // requires an assigned interview (row-level) or answers an explicit 403.
  "candidate:view_one": ["admin", "recruiter", "hiring_manager"],
  "interview:view": ["admin", "recruiter", "hiring_manager"],
  "application:move_stage": ["admin", "recruiter"],
  "interview:schedule": ["admin", "recruiter"],
  "scorecard:submit": ["hiring_manager"],
  "bulk:act": ["admin", "recruiter"],
  "users:manage": ["admin"],
  "analytics:view": ["admin", "recruiter"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}
