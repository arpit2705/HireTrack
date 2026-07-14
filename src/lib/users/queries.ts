import type { Prisma } from "@/generated/prisma/client";
import type { RequestUser } from "@/lib/auth/request";
import { revokeUserSessions } from "@/lib/auth/session";
import { EMAIL_TOKEN_TTL_MS, generateEmailToken } from "@/lib/auth/tokens";
import { db } from "@/lib/db";
import { sendInviteEmail } from "@/lib/mailer";
import type { OrgUpdateInput, Role, UserInviteInput } from "@/lib/schemas";

// Admin user management. Role changes and deactivation are PRIVILEGE
// changes: both revoke every session of the target user immediately - the
// next request with an old cookie is 401, not a stale-role request.

export interface OrgUserWire {
  id: string;
  name: string;
  email: string;
  role: Role;
  emailVerified: boolean;
  deactivatedAt: Date | null;
  createdAt: Date;
}

export async function listOrgUsers(orgId: string): Promise<OrgUserWire[]> {
  const users = await db.user.findMany({
    where: { orgId },
    orderBy: [{ createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      emailVerifiedAt: true,
      deactivatedAt: true,
      createdAt: true,
    },
  });
  return users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    emailVerified: user.emailVerifiedAt !== null,
    deactivatedAt: user.deactivatedAt,
    createdAt: user.createdAt,
  }));
}

export class DuplicateUserEmail extends Error {}
export class CannotModifySelf extends Error {}
export class CannotRemoveLastAdmin extends Error {}

// Last-admin guard. MUST run inside the same transaction as the mutation,
// after taking a per-org advisory lock: the lock serializes concurrent
// admin-removals, so the second of two racing demotions re-counts AFTER the
// first commits (a plain read-then-write would let both pass a stale count
// and leave the org with zero admins). pg_advisory_xact_lock is
// transaction-scoped, so it is safe under pooled connections and releases
// on commit/rollback automatically.
async function assertNotLastAdmin(
  tx: Prisma.TransactionClient,
  orgId: string,
  target: { id: string; role: Role; deactivatedAt: Date | null },
): Promise<void> {
  // Only removing an ACTIVE ADMIN from the pool can drop the count.
  if (target.role !== "admin" || target.deactivatedAt) return;

  // $executeRaw, not $queryRaw: the lock function returns void, which the
  // driver cannot deserialize as a result column.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${orgId}))`;
  const activeAdmins = await tx.user.count({
    where: { orgId, role: "admin", deactivatedAt: null },
  });
  if (activeAdmins - 1 < 1) throw new CannotRemoveLastAdmin();
}

// Invited users have no password yet: the invite email carries a set-password
// link (the password-reset flow), and completing it also verifies the email.
export async function inviteUser(
  admin: RequestUser,
  input: UserInviteInput,
): Promise<OrgUserWire> {
  const email = input.email.toLowerCase();
  if (await db.user.findUnique({ where: { email } })) {
    throw new DuplicateUserEmail();
  }

  const token = generateEmailToken();
  const [user, org] = await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        orgId: admin.orgId,
        email,
        name: input.name,
        role: input.role,
        passwordHash: null,
      },
    });
    await tx.emailToken.create({
      data: {
        userId: user.id,
        tokenHash: token.hash,
        purpose: "password_reset",
        expiresAt: new Date(Date.now() + EMAIL_TOKEN_TTL_MS),
      },
    });
    await tx.activityLog.create({
      data: {
        orgId: admin.orgId,
        actorId: admin.userId,
        entityType: "user",
        entityId: user.id,
        action: "user_invited",
        metadata: { role: input.role },
      },
    });
    const org = await tx.organization.findUniqueOrThrow({
      where: { id: admin.orgId },
    });
    return [user, org] as const;
  });

  await sendInviteEmail(email, org.name, token.raw);
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    emailVerified: false,
    deactivatedAt: null,
    createdAt: user.createdAt,
  };
}

export async function changeUserRole(
  admin: RequestUser,
  targetId: string,
  role: Role,
): Promise<OrgUserWire | null> {
  if (targetId === admin.userId) throw new CannotModifySelf();

  const target = await db.user.findFirst({
    where: { id: targetId, orgId: admin.orgId },
  });
  if (!target) return null;

  if (target.role !== role) {
    await db.$transaction(async (tx) => {
      // Demoting an admin: re-verify inside the transaction, serialized by
      // the advisory lock, that at least one active admin remains.
      if (role !== "admin") await assertNotLastAdmin(tx, admin.orgId, target);
      await tx.user.update({ where: { id: target.id }, data: { role } });
      await tx.activityLog.create({
        data: {
          orgId: admin.orgId,
          actorId: admin.userId,
          entityType: "user",
          entityId: target.id,
          action: "user_role_changed",
          metadata: { from: target.role, to: role },
        },
      });
    });
    // Privilege change: kill every live session for the target.
    await revokeUserSessions(target.id);
  }

  const users = await listOrgUsers(admin.orgId);
  return users.find((user) => user.id === target.id) ?? null;
}

export async function setUserActive(
  admin: RequestUser,
  targetId: string,
  active: boolean,
): Promise<OrgUserWire | null> {
  if (targetId === admin.userId) throw new CannotModifySelf();

  const target = await db.user.findFirst({
    where: { id: targetId, orgId: admin.orgId },
  });
  if (!target) return null;

  await db.$transaction(async (tx) => {
    if (!active) await assertNotLastAdmin(tx, admin.orgId, target);
    await tx.user.update({
      where: { id: target.id },
      data: { deactivatedAt: active ? null : new Date() },
    });
    await tx.activityLog.create({
      data: {
        orgId: admin.orgId,
        actorId: admin.userId,
        entityType: "user",
        entityId: target.id,
        action: active ? "updated" : "user_deactivated",
        metadata: active ? { changed: ["reactivated"] } : {},
      },
    });
  });
  if (!active) {
    // Deactivation revokes immediately; the middleware also treats any
    // remaining session of a deactivated user as dead (belt and braces).
    await revokeUserSessions(target.id);
  }

  const users = await listOrgUsers(admin.orgId);
  return users.find((user) => user.id === target.id) ?? null;
}

export async function updateOrg(admin: RequestUser, input: OrgUpdateInput) {
  return db.$transaction(async (tx) => {
    const org = await tx.organization.update({
      where: { id: admin.orgId },
      data: { name: input.name },
    });
    await tx.activityLog.create({
      data: {
        orgId: admin.orgId,
        actorId: admin.userId,
        entityType: "organization",
        entityId: admin.orgId,
        action: "updated",
        metadata: { changed: ["name"] },
      },
    });
    return { id: org.id, name: org.name, slug: org.slug };
  });
}

// Danger zone: org-wide sign-out (everyone except the acting admin).
export async function signOutAllUsers(admin: RequestUser): Promise<number> {
  const result = await db.session.deleteMany({
    where: {
      user: { orgId: admin.orgId },
      userId: { not: admin.userId },
    },
  });
  await db.activityLog.create({
    data: {
      orgId: admin.orgId,
      actorId: admin.userId,
      entityType: "organization",
      entityId: admin.orgId,
      action: "updated",
      metadata: { changed: ["all_sessions_revoked"], count: result.count },
    },
  });
  return result.count;
}
