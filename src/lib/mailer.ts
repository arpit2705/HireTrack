// One-file mailer so the provider is swappable. Resend when RESEND_API_KEY
// is set; otherwise a console fallback so the verification flow is fully
// testable in dev without any external account.

interface SendEmailArgs {
  to: string;
  subject: string;
  text: string;
}

export function appUrl(): string {
  return (
    process.env.APP_URL ??
    process.env.AUTH_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

export async function sendEmail({ to, subject, text }: SendEmailArgs): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    // Dev fallback only: no key configured means no real mail can leave.
    console.log(
      `[mailer:dev] To: ${to}\n[mailer:dev] Subject: ${subject}\n[mailer:dev] ${text}`,
    );
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? "HireTrack <onboarding@resend.dev>",
      to: [to],
      subject,
      text,
    }),
  });

  if (!response.ok) {
    throw new Error(`Mailer failed: ${response.status} ${await response.text()}`);
  }
}

export async function sendVerificationEmail(
  to: string,
  rawToken: string,
): Promise<void> {
  const url = `${appUrl()}/api/auth/verify-email?token=${rawToken}`;
  await sendEmail({
    to,
    subject: "Verify your HireTrack email",
    text: `Welcome to HireTrack!\n\nVerify your email to unlock full access:\n${url}\n\nThis link expires in 24 hours. If you didn't sign up, ignore this email.`,
  });
}

export async function sendInviteEmail(
  to: string,
  orgName: string,
  rawToken: string,
): Promise<void> {
  const url = `${appUrl()}/reset-password?token=${rawToken}`;
  await sendEmail({
    to,
    subject: `You've been invited to ${orgName} on HireTrack`,
    text: `You've been invited to join ${orgName} on HireTrack.\n\nSet your password to get started:\n${url}\n\nThis link expires in 24 hours.`,
  });
}

export async function sendPasswordResetEmail(
  to: string,
  rawToken: string,
): Promise<void> {
  const url = `${appUrl()}/reset-password?token=${rawToken}`;
  await sendEmail({
    to,
    subject: "Reset your HireTrack password",
    text: `Someone requested a password reset for this address.\n\nReset it here:\n${url}\n\nThis link expires in 24 hours. If this wasn't you, ignore this email - your password is unchanged.`,
  });
}
