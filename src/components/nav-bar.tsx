"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
}

export function NavBar({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className="flex items-center gap-1">
      {items.map(({ href, label }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className={[
              "relative px-3 py-1.5 text-sm font-medium rounded-lg transition-colors duration-150",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              active
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/60",
            ].join(" ")}
          >
            {label}
            {active && (
              <span
                className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full bg-primary"
                style={{ animation: "nav-underline-grow 200ms ease-out both" }}
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
