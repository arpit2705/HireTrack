import { type NextRequest, NextResponse } from "next/server";
import { decideAccess } from "@/lib/auth/access";
import { getSessionInfo, readSessionToken } from "@/lib/auth/session";

// Server-side RBAC on every route (plan.md section 5): the role comes from
// the database session row, never from anything the client sent. Row-level
// scoping (own org/jobs/interviews) is layered on inside route handlers.
// Next 16 "proxy" convention (ex-middleware); runs on the Node runtime,
// which database sessions need for Prisma.

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
};

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Per-request CSP with a script nonce (milestone-12 experiment, kept: it
// clears the DevTools CSP issue Lighthouse flags for 'unsafe-inline').
// Next.js reads the CSP REQUEST header, applies the nonce to its own inline
// scripts, and switches nonce-bearing routes to dynamic rendering.
function buildCsp(nonce: string): string {
  // nonce is currently unused in the policy (see the measured verdict
  // below) but stays plumbed so re-enabling is a one-line change.
  void nonce;
  const isDev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    // MEASURED VERDICT (milestone 12): 'unsafe-inline' stays, for now.
    // Two nonce variants were tried against the production build:
    //  - nonce + 'strict-dynamic': Turbopack does not nonce chunk preloads
    //    -> CSP violations on every <link rel=preload>, BP 96 -> 92.
    //  - 'self' + nonce: Next's Suspense STREAMING inline scripts are
    //    emitted mid-render without nonces -> blocked scripts + console
    //    errors on every streaming page (login), BP 92.
    // Lighthouse's csp-xss audit is informative (no score reward for
    // nonces). Until Next nonces its streaming scripts, nonce CSP is a
    // measured regression on this stack. The nonce plumbing (x-nonce header,
    // JSON-LD nonce attr) is kept so flipping this line is the whole change.
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data: https://lh3.googleusercontent.com",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApi = pathname.startsWith("/api/");

  // CSRF, layer 2 (SameSite=Lax cookies are layer 1): cross-origin
  // state-changing requests are rejected outright. Browsers always send
  // Origin on cross-origin requests; absent Origin = non-browser client,
  // which carries no ambient cookie authority to abuse.
  if (WRITE_METHODS.has(request.method)) {
    const origin = request.headers.get("origin");
    if (origin) {
      let originHost: string | null = null;
      try {
        originHost = new URL(origin).host;
      } catch {
        // malformed Origin header -> reject below
      }
      if (!originHost || originHost !== request.headers.get("host")) {
        return NextResponse.json({ error: "csrf_origin" }, { status: 403 });
      }
    }
  }

  const sessionToken = readSessionToken(request.cookies);
  const session = sessionToken ? await getSessionInfo(sessionToken) : null;

  // Authenticated users don't belong on the auth pages or the marketing
  // landing - drop them straight into the product (zero clicks to content;
  // hiring managers land on their interviews since /jobs is closed to them).
  if (
    session &&
    (pathname === "/" || pathname === "/login" || pathname === "/signup")
  ) {
    const home = session.role === "hiring_manager" ? "/interviews" : "/jobs";
    return NextResponse.redirect(new URL(home, request.url));
  }

  const decision = decideAccess(pathname, request.method, session);

  if (decision.type === "login") {
    if (isApi) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (decision.type === "forbidden") {
    if (isApi) {
      return NextResponse.json({ error: decision.reason }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Never trust inbound identity headers; they are set here or not at all.
  const headers = new Headers(request.headers);
  headers.delete("x-user-id");
  headers.delete("x-user-role");
  headers.delete("x-org-id");
  if (session) {
    headers.set("x-user-id", session.userId);
    headers.set("x-user-role", session.role);
    headers.set("x-org-id", session.orgId);
  }

  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp(nonce);
  headers.set("x-nonce", nonce);
  headers.set("content-security-policy", csp);

  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}
