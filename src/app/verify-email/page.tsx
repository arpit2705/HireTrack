import Link from "next/link";
import { AuthCard, FormAlert } from "@/components/form";

// Landing page for /api/auth/verify-email redirects. Pure server component;
// the status query param selects which of the states to render.

const CONTENT: Record<
  string,
  { title: string; tone: "success" | "error"; body: string }
> = {
  success: {
    title: "Email verified",
    tone: "success",
    body: "Your email is verified and full access is unlocked. You can log in now.",
  },
  expired: {
    title: "Link expired",
    tone: "error",
    body: "This verification link has expired. Log in and request a new one from your account, or contact your organization admin.",
  },
  invalid: {
    title: "Link invalid",
    tone: "error",
    body: "This verification link is invalid or was already used. If your email is already verified, just log in.",
  },
};

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const content = status ? CONTENT[status] : undefined;

  if (!content) {
    return (
      <AuthCard title="Verify your email">
        <p className="text-base text-zinc-600 dark:text-zinc-400">
          We sent you a verification link. Open it in this browser to unlock
          full access. The link expires after 24 hours.
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={content.title}>
      <FormAlert tone={content.tone}>{content.body}</FormAlert>
      <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
        <Link
          href="/login"
          className="rounded font-medium text-indigo-600 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:text-indigo-400"
        >
          Go to login
        </Link>
      </p>
    </AuthCard>
  );
}
