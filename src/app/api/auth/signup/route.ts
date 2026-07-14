import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth/password";
import { EMAIL_TOKEN_TTL_MS, generateEmailToken } from "@/lib/auth/tokens";
import { db } from "@/lib/db";
import { sendVerificationEmail } from "@/lib/mailer";
import { signupInputSchema } from "@/lib/schemas";

// Signup creates the organization plus its first (admin) user - plan.md
// section 2: "As an Admin, I can create the organization". Recruiters and
// hiring managers join via invitation (settings milestone), never signup.

function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "org";
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = signupInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { orgName, name, password } = parsed.data;
  const email = parsed.data.email.toLowerCase();

  if (await db.user.findUnique({ where: { email } })) {
    return NextResponse.json({ error: "email_taken" }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const token = generateEmailToken();
  const slugBase = slugify(orgName);

  try {
    const user = await db.$transaction(async (tx) => {
      let slug = slugBase;
      for (
        let n = 2;
        await tx.organization.findUnique({ where: { slug } });
        n++
      ) {
        slug = `${slugBase}-${n}`;
      }

      const org = await tx.organization.create({
        data: { name: orgName, slug },
      });
      const user = await tx.user.create({
        data: { orgId: org.id, email, name, passwordHash, role: "admin" },
      });
      await tx.emailToken.create({
        data: {
          userId: user.id,
          tokenHash: token.hash,
          purpose: "verify_email",
          expiresAt: new Date(Date.now() + EMAIL_TOKEN_TTL_MS),
        },
      });
      await tx.activityLog.create({
        data: {
          orgId: org.id,
          actorId: user.id,
          entityType: "organization",
          entityId: org.id,
          action: "created",
          metadata: { via: "signup" },
        },
      });
      return user;
    });

    await sendVerificationEmail(email, token.raw);

    return NextResponse.json(
      {
        ok: true,
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
      },
      { status: 201 },
    );
  } catch (error) {
    // Unique-violation race on email/slug between check and create.
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "email_taken" }, { status: 409 });
    }
    throw error;
  }
}
