import type { DefaultSession } from "next-auth";
import type { Role } from "@/lib/schemas";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      orgId: string;
      emailVerifiedAt: Date | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    credentials?: boolean;
  }
}

// The database session strategy hands our full Prisma user row to callbacks.
declare module "@auth/core/adapters" {
  interface AdapterUser {
    role: Role;
    orgId: string;
    emailVerifiedAt: Date | null;
    deactivatedAt: Date | null;
  }
}
