// Client-side helpers for the candidates API: one place for fetch, error
// mapping, and the resume upload contract, shared by the create and detail
// screens.

import type { CandidateWire } from "@/lib/candidates/queries";
import type {
  CandidateCreateInput,
  CandidateUpdateInput,
} from "@/lib/schemas";

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

async function parseFailure(response: Response): Promise<ApiResult<never>> {
  let body: { error?: string; issues?: Record<string, string[]> } = {};
  try {
    body = await response.json();
  } catch {
    // fall through with generic error
  }
  if (body.issues) {
    const fieldErrors: Record<string, string> = {};
    for (const [key, messages] of Object.entries(body.issues)) {
      if (messages?.[0]) fieldErrors[key] = messages[0];
    }
    return { ok: false, error: body.error ?? "validation", fieldErrors };
  }
  return { ok: false, error: body.error ?? `http_${response.status}` };
}

async function jsonRequest<T>(
  url: string,
  method: string,
  body: unknown,
): Promise<ApiResult<T>> {
  try {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (response.ok) return { ok: true, data: (await response.json()) as T };
    return await parseFailure(response);
  } catch {
    return { ok: false, error: "network" };
  }
}

export function createCandidateRequest(
  input: CandidateCreateInput,
): Promise<ApiResult<CandidateWire>> {
  return jsonRequest("/api/candidates", "POST", input);
}

export function updateCandidateRequest(
  id: string,
  input: CandidateUpdateInput,
): Promise<ApiResult<CandidateWire>> {
  return jsonRequest(`/api/candidates/${id}`, "PATCH", input);
}

export async function uploadResumeRequest(
  id: string,
  file: File,
): Promise<ApiResult<CandidateWire>> {
  const form = new FormData();
  form.append("file", file);
  try {
    const response = await fetch(`/api/candidates/${id}/resume`, {
      method: "PUT",
      body: form,
    });
    if (response.ok) {
      return { ok: true, data: (await response.json()) as CandidateWire };
    }
    return await parseFailure(response);
  } catch {
    return { ok: false, error: "network" };
  }
}

export const API_ERROR_MESSAGES: Record<string, string> = {
  email_exists: "A candidate with this email already exists in your organization.",
  email_not_verified: "Verify your email before making changes — check your inbox.",
  unsupported_type: "That file isn't a PDF or Word document. Only .pdf, .doc, and .docx are accepted.",
  too_large: "That file is over the 5 MB limit.",
  storage_not_configured:
    "Resume storage isn't configured on this deployment, so uploads are disabled.",
  network: "Could not reach the server. Check your connection and try again.",
};

export function messageFor(error: string): string {
  return API_ERROR_MESSAGES[error] ?? "Something went wrong. Please try again.";
}

export function parseTagsInput(value: string): string[] {
  return [...new Set(value.split(",").map((tag) => tag.trim()).filter(Boolean))];
}
