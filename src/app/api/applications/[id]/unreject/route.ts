import { NextResponse } from "next/server";
import {
  ApplicationNotRejected,
  unrejectApplication,
} from "@/lib/applications/queries";
import { requireUser } from "@/lib/auth/request";

type Params = { params: Promise<{ id: string }> };

// POST /api/applications/:id/unreject  (recruiter+ via proxy, org-scoped)
export async function POST(_request: Request, { params }: Params) {
  const user = await requireUser();
  const { id } = await params;

  try {
    const application = await unrejectApplication(user, id);
    if (!application) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json(application);
  } catch (error) {
    if (error instanceof ApplicationNotRejected) {
      return NextResponse.json({ error: "not_rejected" }, { status: 409 });
    }
    throw error;
  }
}
