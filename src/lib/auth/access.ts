import { can, type Permission } from "@/lib/auth/permissions";
import type { Role } from "@/lib/schemas";

// Route-level access decisions for the RBAC middleware. Pure function so the
// full plan.md section 5 matrix is unit-testable without HTTP.
//
// Row-level scoping (own org, own jobs, own interviews) cannot be decided
// from a path alone and lives in the route handlers as a second layer.

export interface SessionInfo {
  userId: string;
  orgId: string;
  role: Role;
  emailVerified: boolean;
}

export type AccessDecision =
  | { type: "allow" }
  | { type: "login" }
  | { type: "forbidden"; reason: string };

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Paths reachable without a session. /api/auth covers Auth.js endpoints plus
// our signup/verify/reset handlers (all self-protected and rate-limited).
const PUBLIC_PATHS = [
  "/",
  "/login",
  "/signup",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
  // Fetched anonymously by link-unfurl scrapers (Slack, Twitter, Google).
  "/opengraph-image",
];
const PUBLIC_PREFIXES = ["/api/auth/", "/api/auth"];

interface RouteRule {
  pattern: RegExp;
  methods?: readonly string[]; // undefined = all methods
  permission: Permission;
}

// Every API route MUST have a rule here: unmatched /api paths are denied.
// App PAGES needing role rules are tracked in docs/architecture.md (the
// enforcement ledger) and added here as their milestones build them.
const ROUTE_RULES: readonly RouteRule[] = [
  // --- Pages (ledger rows; find-first, so specific rules precede catch-alls) ---
  { pattern: /^\/jobs(\/|$)/, permission: "job:view" },
  { pattern: /^\/candidates\/new$/, permission: "candidate:view_all" },
  {
    pattern: /^\/candidates\/[^/]+$/,
    methods: ["GET"],
    permission: "candidate:view_one",
  },
  { pattern: /^\/candidates(\/|$)/, permission: "candidate:view_all" },
  {
    pattern: /^\/interviews\/[^/]+\/scorecard$/,
    permission: "scorecard:submit",
  },
  { pattern: /^\/interviews(\/|$)/, permission: "interview:view" },
  { pattern: /^\/analytics(\/|$)/, permission: "analytics:view" },
  { pattern: /^\/settings(\/|$)/, permission: "users:manage" },
  // --- API ---
  { pattern: /^\/api\/org(\/|$)/, permission: "users:manage" },
  {
    pattern: /^\/api\/users\/interviewers$/,
    methods: ["GET"],
    permission: "interview:schedule",
  },
  {
    pattern: /^\/api\/candidates\/[^/]+\/resume$/,
    methods: ["GET"],
    permission: "candidate:view_one",
  },
  {
    pattern: /^\/api\/candidates\/[^/]+$/,
    methods: ["GET"],
    permission: "candidate:view_one",
  },
  {
    pattern: /^\/api\/interviews(\/|$)/,
    methods: ["GET"],
    permission: "interview:view",
  },
  { pattern: /^\/api\/jobs(\/|$)/, methods: ["GET"], permission: "job:view" },
  { pattern: /^\/api\/jobs(\/|$)/, permission: "job:manage" },
  {
    pattern: /^\/api\/candidates(\/|$)/,
    permission: "candidate:view_all",
  },
  {
    pattern: /^\/api\/applications\/bulk-reject$/,
    permission: "bulk:act",
  },
  {
    pattern: /^\/api\/applications\/export$/,
    permission: "bulk:act",
  },
  {
    pattern: /^\/api\/applications(\/|$)/,
    permission: "application:move_stage",
  },
  {
    pattern: /^\/api\/interviews\/[^/]+\/scorecard$/,
    permission: "scorecard:submit",
  },
  {
    pattern: /^\/api\/interviews(\/|$)/,
    permission: "interview:schedule",
  },
  { pattern: /^\/api\/analytics(\/|$)/, permission: "analytics:view" },
  { pattern: /^\/api\/users(\/|$)/, permission: "users:manage" },
];

function isPublic(pathname: string): boolean {
  return (
    PUBLIC_PATHS.includes(pathname) ||
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

export function decideAccess(
  pathname: string,
  method: string,
  session: SessionInfo | null,
): AccessDecision {
  if (isPublic(pathname)) return { type: "allow" };

  if (!session) return { type: "login" };

  // Email verification gates ALL write access (plan.md section 11).
  if (WRITE_METHODS.has(method) && !session.emailVerified) {
    return { type: "forbidden", reason: "email_not_verified" };
  }

  const isApi = pathname.startsWith("/api/");

  const rule = ROUTE_RULES.find(
    (r) =>
      r.pattern.test(pathname) && (!r.methods || r.methods.includes(method)),
  );

  if (rule) {
    return can(session.role, rule.permission)
      ? { type: "allow" }
      : { type: "forbidden", reason: `missing_permission:${rule.permission}` };
  }

  // Default-deny unregistered API routes; app pages only need a session
  // (their data access goes through /api or scoped server queries anyway).
  if (isApi) return { type: "forbidden", reason: "unregistered_api_route" };
  return { type: "allow" };
}
