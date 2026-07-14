import { NextResponse } from "next/server";
import {
  ApplicationRejectedError,
  InvalidStageMove,
  moveApplicationStage,
} from "@/lib/applications/queries";
import { requireUser } from "@/lib/auth/request";
import { stageMoveSchema } from "@/lib/schemas";

type Params = { params: Promise<{ id: string }> };

// PATCH /api/applications/:id/stage  (recruiter+ only - the matrix bars
// hiring managers at the proxy; returns the updated record)
export async function PATCH(request: Request, { params }: Params) {
  const user = await requireUser();
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = stageMoveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const application = await moveApplicationStage(user, id, parsed.data.stage);
    if (!application) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json(application);
  } catch (error) {
    if (error instanceof InvalidStageMove) {
      return NextResponse.json(
        { error: "invalid_stage_move", message: error.message },
        { status: 409 },
      );
    }
    if (error instanceof ApplicationRejectedError) {
      return NextResponse.json(
        { error: "application_rejected" },
        { status: 409 },
      );
    }
    throw error;
  }
}
