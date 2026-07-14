import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/request";
import {
  getCandidate,
  setCandidateResume,
} from "@/lib/candidates/queries";
import { hasAssignedInterview } from "@/lib/interviews/queries";
import { readStoredFile } from "@/lib/storage";
import {
  MAX_RESUME_BYTES,
  contentTypeForLocator,
  validateResume,
} from "@/lib/uploads/resume";

type Params = { params: Promise<{ id: string }> };

// PUT /api/candidates/:id/resume  (recruiter+, org-scoped)
// multipart/form-data with a "file" field. The declared Content-Type is
// ignored: magic bytes decide, and the size cap is enforced server-side on
// the actual bytes (Content-Length is only used to refuse hopeless requests
// before buffering them).
export async function PUT(request: Request, { params }: Params) {
  const user = await requireUser();
  const { id } = await params;

  // Serverless has no writable local disk; without a Blob token uploads
  // must fail loudly-but-gracefully rather than 500 on a doomed write.
  if (process.env.VERCEL && !process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "storage_not_configured" },
      { status: 503 },
    );
  }

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_RESUME_BYTES + 64 * 1024) {
    return NextResponse.json({ error: "too_large" }, { status: 413 });
  }

  let file: File | null = null;
  try {
    const form = await request.formData();
    const entry = form.get("file");
    file = entry instanceof File ? entry : null;
  } catch {
    return NextResponse.json({ error: "invalid_form_data" }, { status: 400 });
  }
  if (!file) {
    return NextResponse.json({ error: "missing_file" }, { status: 400 });
  }

  const data = Buffer.from(await file.arrayBuffer());
  const verdict = validateResume(data, file.type);
  if (!verdict.ok) {
    return NextResponse.json(
      { error: verdict.reason },
      { status: verdict.reason === "too_large" ? 413 : 415 },
    );
  }

  const candidate = await setCandidateResume(
    user,
    id,
    data,
    verdict.contentType,
    verdict.extension,
  );
  if (!candidate) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json(candidate);
}

// GET /api/candidates/:id/resume  (org-scoped)
// The ONLY path to resume bytes. Org and role are re-checked on every
// request; the storage locator never appears in the response. Hiring
// managers need an assigned interview on this candidate (explicit 403).
export async function GET(_request: Request, { params }: Params) {
  const user = await requireUser();
  const { id } = await params;

  const candidate = await getCandidate(user.orgId, id);
  if (!candidate?.resumeUrl) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (
    user.role === "hiring_manager" &&
    !(await hasAssignedInterview(user.userId, candidate.id))
  ) {
    return NextResponse.json({ error: "not_assigned" }, { status: 403 });
  }

  const contentType = contentTypeForLocator(candidate.resumeUrl);
  if (!contentType) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const file = await readStoredFile(candidate.resumeUrl, contentType);
  if (!file) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const safeName = candidate.name.replace(/[^a-zA-Z0-9-]+/g, "-").slice(0, 60);
  const extension = contentType === "application/pdf" ? "pdf"
    : contentType === "application/msword" ? "doc" : "docx";

  return new NextResponse(new Uint8Array(file.data), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="resume-${safeName}.${extension}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
