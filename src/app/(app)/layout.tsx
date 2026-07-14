import Link from "next/link";
import type { ReactNode } from "react";
import { NavBar } from "@/components/nav-bar";
import { Providers } from "@/components/providers";
import { SignOutButton } from "@/components/sign-out-button";
import { can } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/request";

// Shell for authenticated app pages. Nav visibility follows the permission
// matrix, but that is UX only - real enforcement happens in src/proxy.ts.
export default async function AppLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireUser();

  const navItems = [
    ...(can(user.role, "job:view") ? [{ href: "/jobs", label: "Jobs" }] : []),
    ...(can(user.role, "candidate:view_all")
      ? [{ href: "/candidates", label: "Candidates" }]
      : []),
    { href: "/interviews", label: "Interviews" },
    ...(can(user.role, "analytics:view")
      ? [{ href: "/analytics", label: "Analytics" }]
      : []),
    ...(can(user.role, "users:manage")
      ? [{ href: "/settings", label: "Settings" }]
      : []),
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky header floats above the ambient background */}
      <header
        className={[
          "sticky top-0 z-40 border-b border-[#E3E1F5]",
          "bg-background/90 backdrop-blur-md",
          "transition-shadow duration-200",
        ].join(" ")}
        id="app-header"
      >
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4">
          {/* Logo wordmark */}
          <div className="flex items-center gap-6">
            <Link
              href="/jobs"
              className="font-grotesk text-lg font-bold tracking-tight text-primary rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              HireTrack
            </Link>

            {/* Nav items — client component for active detection */}
            <NavBar items={navItems} />
          </div>

          {/* Sign out — quietly positioned, ghost style */}
          <SignOutButton />
        </div>
      </header>

      {/* Main content — z-10 so it layers above ambient blobs (z-0) */}
      <main className="relative z-10 mx-auto w-full max-w-6xl px-4 py-8">
        <Providers>{children}</Providers>
      </main>
    </div>
  );
}
