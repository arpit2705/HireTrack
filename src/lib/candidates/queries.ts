import { randomBytes } from "node:crypto";
import type { RequestUser } from "@/lib/auth/request";
import { db } from "@/lib/db";
import { deleteStoredFile, storeFile } from "@/lib/storage";
import type {
  CandidateCreateInput,
  CandidateListQuery,
  CandidateUpdateInput,
} from "@/lib/schemas";

// Org-scoped candidate queries (same boundary pattern as jobs). The DB row's
// resumeUrl column holds the internal storage locator; serializeCandidate
// swaps it for the app-relative download path so the locator never leaves
// the server.

type CandidateRecord = Awaited<
  ReturnType<typeof db.candidate.findFirstOrThrow>
>;

export interface CandidateWire {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  source: string | null;
  tags: string[];
  resumeUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function serializeCandidate(row: CandidateRecord): CandidateWire {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    source: row.source,
    tags: row.tags,
    resumeUrl: row.resumeUrl ? `/api/candidates/${row.id}/resume` : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

const SORT_ORDER: Record<
  CandidateListQuery["sort"],
  Array<Record<string, "asc" | "desc">>
> = {
  created_desc: [{ createdAt: "desc" }, { id: "desc" }],
  created_asc: [{ createdAt: "asc" }, { id: "asc" }],
  name_asc: [{ name: "asc" }, { id: "asc" }],
};

export async function listCandidates(orgId: string, query: CandidateListQuery) {
  const rows = await db.candidate.findMany({
    where: {
      orgId,
      ...(query.tag ? { tags: { has: query.tag } } : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: "insensitive" as const } },
              { email: { contains: query.q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: SORT_ORDER[query.sort],
    take: query.limit + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > query.limit;
  const items = hasMore ? rows.slice(0, query.limit) : rows;
  return {
    items: items.map(serializeCandidate),
    nextCursor: hasMore ? (items[items.length - 1]?.id ?? null) : null,
  };
}

export function getCandidate(
  orgId: string,
  id: string,
): Promise<CandidateRecord | null> {
  return db.candidate.findFirst({ where: { id, orgId } });
}

export class DuplicateCandidateEmail extends Error {}

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string }).code === "P2002";
}

export async function createCandidate(
  user: RequestUser,
  input: CandidateCreateInput,
): Promise<CandidateWire> {
  try {
    const row = await db.$transaction(async (tx) => {
      const candidate = await tx.candidate.create({
        data: {
          orgId: user.orgId,
          name: input.name,
          email: input.email.toLowerCase(),
          phone: input.phone ?? null,
          source: input.source ?? null,
          tags: input.tags,
        },
      });
      await tx.activityLog.create({
        data: {
          orgId: user.orgId,
          actorId: user.userId,
          entityType: "candidate",
          entityId: candidate.id,
          action: "created",
          metadata: { name: candidate.name },
        },
      });
      return candidate;
    });
    return serializeCandidate(row);
  } catch (error) {
    if (isUniqueViolation(error)) throw new DuplicateCandidateEmail();
    throw error;
  }
}

export async function updateCandidate(
  user: RequestUser,
  id: string,
  input: CandidateUpdateInput,
): Promise<CandidateWire | null> {
  try {
    const row = await db.$transaction(async (tx) => {
      const candidate = await tx.candidate.findFirst({
        where: { id, orgId: user.orgId },
      });
      if (!candidate) return null;

      const updated = await tx.candidate.update({
        where: { id: candidate.id },
        data: {
          ...input,
          ...(input.email ? { email: input.email.toLowerCase() } : {}),
        },
      });
      await tx.activityLog.create({
        data: {
          orgId: user.orgId,
          actorId: user.userId,
          entityType: "candidate",
          entityId: candidate.id,
          action: "updated",
          metadata: { changed: Object.keys(input) },
        },
      });
      return updated;
    });
    return row ? serializeCandidate(row) : null;
  } catch (error) {
    if (isUniqueViolation(error)) throw new DuplicateCandidateEmail();
    throw error;
  }
}

// Stores the validated resume bytes and swaps the candidate's locator; the
// previous file is deleted after the DB commit so a failed update never
// orphans the current resume.
export async function setCandidateResume(
  user: RequestUser,
  id: string,
  data: Buffer,
  contentType: string,
  extension: string,
): Promise<CandidateWire | null> {
  const candidate = await db.candidate.findFirst({
    where: { id, orgId: user.orgId },
  });
  if (!candidate) return null;

  const key = `resumes/${user.orgId}/${candidate.id}/${randomBytes(16).toString("hex")}.${extension}`;
  const locator = await storeFile(key, data, contentType);

  const previous = candidate.resumeUrl;
  const updated = await db.$transaction(async (tx) => {
    const row = await tx.candidate.update({
      where: { id: candidate.id },
      data: { resumeUrl: locator },
    });
    await tx.activityLog.create({
      data: {
        orgId: user.orgId,
        actorId: user.userId,
        entityType: "candidate",
        entityId: candidate.id,
        action: "updated",
        metadata: { changed: ["resume"], contentType, bytes: data.byteLength },
      },
    });
    return row;
  });

  if (previous) {
    await deleteStoredFile(previous).catch(() => {
      // Orphaned file cleanup failure is not a user-facing error.
    });
  }
  return serializeCandidate(updated);
}
