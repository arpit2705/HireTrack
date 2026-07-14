import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireUser } from "@/lib/auth/request";
import { db } from "@/lib/db";
import { listOrgUsers } from "@/lib/users/queries";
import {
  InviteForm,
  OrgNameForm,
  SignOutAllButton,
  UserActions,
} from "./settings-client";

export const metadata: Metadata = { title: "Settings" };

const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium" });

type UserRole = "admin" | "recruiter" | "hiring_manager";

const ROLE_BADGE: Record<UserRole, "role-admin" | "role-recruiter" | "role-hiring-manager"> = {
  admin: "role-admin",
  recruiter: "role-recruiter",
  hiring_manager: "role-hiring-manager",
};

export default async function SettingsPage() {
  const user = await requireUser(); // proxy guarantees admin here
  const [org, users] = await Promise.all([
    db.organization.findUniqueOrThrow({ where: { id: user.orgId } }),
    listOrgUsers(user.orgId),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-grotesk text-3xl font-bold tracking-tight text-foreground">Settings</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Manage your organization, users, and account settings.
        </p>
      </div>

      {/* Organization section */}
      <section className="rounded-2xl border border-[#E3E1F5] bg-white p-6 shadow-card space-y-4">
        <div>
          <h2 className="font-grotesk text-lg font-semibold text-foreground">Organization</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Update your organization name and view its slug.
          </p>
        </div>
        <OrgNameForm initialName={org.name} />
        <p className="font-jetbrains text-xs text-muted-foreground">
          Slug:{" "}
          <span className="text-foreground font-semibold">{org.slug}</span>
        </p>
      </section>

      {/* Users section */}
      <section className="rounded-2xl border border-[#E3E1F5] bg-white p-6 shadow-card space-y-5">
        <div>
          <h2 className="font-grotesk text-lg font-semibold text-foreground">Users</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Invite teammates and manage their roles.
          </p>
        </div>
        <InviteForm />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((orgUser) => (
              <TableRow key={orgUser.id}>
                <TableCell className="font-medium text-foreground">
                  {orgUser.name}
                </TableCell>
                <TableCell className="font-jetbrains text-xs text-muted-foreground">
                  {orgUser.email}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      ROLE_BADGE[orgUser.role as UserRole] ?? "role-recruiter"
                    }
                  >
                    {orgUser.role.replace("_", " ")}
                  </Badge>
                </TableCell>
                <TableCell>
                  {orgUser.deactivatedAt ? (
                    <Badge variant="user-deactivated">deactivated</Badge>
                  ) : orgUser.emailVerified ? (
                    <Badge variant="user-active">active</Badge>
                  ) : (
                    <Badge variant="user-invited">invited</Badge>
                  )}
                </TableCell>
                <TableCell className="font-jetbrains text-xs text-muted-foreground">
                  {dateFormat.format(orgUser.createdAt)}
                </TableCell>
                <TableCell>
                  <UserActions
                    userId={orgUser.id}
                    role={orgUser.role}
                    deactivated={orgUser.deactivatedAt !== null}
                    isSelf={orgUser.id === user.userId}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      {/* Danger zone */}
      <section className="rounded-2xl border border-[#FF7A59]/35 bg-[#FF7A59]/5 p-6 space-y-4">
        <div>
          <h2 className="font-grotesk text-lg font-semibold text-[#7A2010]">
            Danger zone
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Immediately signs out every user in the organization except you, by
            revoking their sessions server-side. They must log in again.
          </p>
        </div>
        <SignOutAllButton />
      </section>
    </div>
  );
}
