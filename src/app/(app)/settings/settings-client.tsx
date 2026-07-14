"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormAlert } from "@/components/form";
import type { Role } from "@/lib/schemas";

const selectClass =
  "flex h-8 rounded-md border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

async function call(
  url: string,
  method: string,
  body?: unknown,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch(url, {
      method,
      ...(body
        ? {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        : {}),
    });
    if (response.ok) return { ok: true };
    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    return { ok: false, error: data.error };
  } catch {
    return { ok: false, error: "network" };
  }
}

const MESSAGES: Record<string, string> = {
  email_taken: "A user with this email already exists.",
  cannot_modify_self: "You can't change your own role or deactivate yourself.",
  network: "Could not reach the server. Try again.",
};
const messageFor = (error?: string) =>
  MESSAGES[error ?? ""] ?? "Something went wrong. Try again.";

export function OrgNameForm({ initialName }: { initialName: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{
    tone: "error" | "success";
    text: string;
  } | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get("name") ?? "");
    setPending(true);
    const result = await call("/api/org", "PATCH", { name });
    setPending(false);
    setMessage(
      result.ok
        ? { tone: "success", text: "Organization renamed." }
        : { tone: "error", text: messageFor(result.error) },
    );
    if (result.ok) router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {message ? <FormAlert tone={message.tone}>{message.text}</FormAlert> : null}
      <div className="flex items-end gap-3">
        <div className="w-full max-w-sm space-y-2">
          <Label htmlFor="org-name">Organization name</Label>
          <Input id="org-name" name="name" defaultValue={initialName} required />
        </div>
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}

export function InviteForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{
    tone: "error" | "success";
    text: string;
  } | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    setPending(true);
    const result = await call("/api/users", "POST", data);
    setPending(false);
    if (result.ok) {
      setMessage({
        tone: "success",
        text: `Invite sent to ${String(data.email)} — they set a password via the emailed link.`,
      });
      form.reset();
      router.refresh();
    } else {
      setMessage({ tone: "error", text: messageFor(result.error) });
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <h3 className="text-sm font-medium">Invite a user</h3>
      {message ? <FormAlert tone={message.tone}>{message.text}</FormAlert> : null}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <Label htmlFor="invite-name">Name</Label>
          <Input id="invite-name" name="name" required className="h-9" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="invite-email">Email</Label>
          <Input
            id="invite-email"
            name="email"
            type="email"
            required
            className="h-9"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="invite-role">Role</Label>
          <select
            id="invite-role"
            name="role"
            defaultValue="recruiter"
            className="flex h-9 min-w-36 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <option value="recruiter">Recruiter</option>
            <option value="hiring_manager">Hiring manager</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Inviting…" : "Send invite"}
        </Button>
      </div>
    </form>
  );
}

export function UserActions({
  userId,
  role,
  deactivated,
  isSelf,
}: {
  userId: string;
  role: Role;
  deactivated: boolean;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(url: string, method: string, body?: unknown) {
    setError(null);
    setPending(true);
    const result = await call(url, method, body);
    setPending(false);
    if (result.ok) router.refresh();
    else setError(messageFor(result.error));
  }

  if (isSelf) {
    return <span className="text-xs text-muted-foreground">you</span>;
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {error ? (
        <span role="alert" className="text-xs text-destructive">
          {error}
        </span>
      ) : null}
      <label htmlFor={`role-${userId}`} className="sr-only">
        Change role
      </label>
      <select
        id={`role-${userId}`}
        value={role}
        disabled={pending || deactivated}
        onChange={(event) =>
          run(`/api/users/${userId}`, "PATCH", { role: event.target.value })
        }
        className={selectClass}
      >
        <option value="admin">admin</option>
        <option value="recruiter">recruiter</option>
        <option value="hiring_manager">hiring manager</option>
      </select>
      <Button
        size="sm"
        variant={deactivated ? "secondary" : "ghost"}
        disabled={pending}
        className={deactivated ? "h-8 text-xs" : "h-8 text-xs text-destructive hover:text-destructive"}
        onClick={() =>
          run(
            `/api/users/${userId}/${deactivated ? "reactivate" : "deactivate"}`,
            "POST",
          )
        }
      >
        {deactivated ? "Reactivate" : "Deactivate"}
      </Button>
    </div>
  );
}

export function SignOutAllButton() {
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function run() {
    setPending(true);
    setConfirming(false);
    const response = await fetch("/api/org/sessions", { method: "DELETE" });
    setPending(false);
    if (response.ok) {
      const { revoked } = (await response.json()) as { revoked: number };
      setMessage(`Signed out ${revoked} session${revoked === 1 ? "" : "s"}.`);
    } else {
      setMessage("Failed — try again.");
    }
  }

  return (
    <div className="flex items-center gap-3">
      {confirming ? (
        <>
          <span className="text-sm font-medium">
            Sign out every user except you?
          </span>
          <Button size="sm" variant="destructive" disabled={pending} onClick={run}>
            Confirm
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
            Cancel
          </Button>
        </>
      ) : (
        <Button
          variant="destructive"
          disabled={pending}
          onClick={() => setConfirming(true)}
        >
          Sign out all users
        </Button>
      )}
      {message ? (
        <span className="text-sm text-muted-foreground">{message}</span>
      ) : null}
    </div>
  );
}
